import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { spawn } from 'child_process';

const PackageSchema = Type.Object({
  name: Type.String(),
  version: Type.String(),
  description: Type.Optional(Type.String()),
  installed: Type.Boolean(),
  size: Type.Optional(Type.Number()),
  dependencies: Type.Optional(Type.Array(Type.String()))
});

const InstallRequestSchema = Type.Object({
  packages: Type.Array(Type.String({ minLength: 1 })),
  sessionId: Type.String({ format: 'uuid' }),
  force: Type.Optional(Type.Boolean())
});

const UninstallRequestSchema = Type.Object({
  packages: Type.Array(Type.String({ minLength: 1 })),
  sessionId: Type.String({ format: 'uuid' })
});

const packagesRoute: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // List available packages
  server.get('/', {
    schema: {
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        category: Type.Optional(Type.Union([
          Type.Literal('data-science'),
          Type.Literal('machine-learning'),
          Type.Literal('visualization'),
          Type.Literal('web'),
          Type.Literal('utility')
        ])),
        installed: Type.Optional(Type.Boolean())
      }),
      response: {
        200: Type.Object({
          packages: Type.Array(PackageSchema),
          total: Type.Number(),
          categories: Type.Array(Type.String())
        })
      }
    }
  }, async (request, reply) => {
    const { search, category, installed } = request.query;

    try {
      const allPackages = await getAvailablePackages();
      let filteredPackages = allPackages;

      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPackages = filteredPackages.filter(pkg =>
          pkg.name.toLowerCase().includes(searchLower) ||
          (pkg.description && pkg.description.toLowerCase().includes(searchLower))
        );
      }

      // Filter by category
      if (category) {
        filteredPackages = filteredPackages.filter(pkg =>
          getPackageCategory(pkg.name) === category
        );
      }

      // Filter by installation status
      if (installed !== undefined) {
        filteredPackages = filteredPackages.filter(pkg =>
          pkg.installed === installed
        );
      }

      const categories = [
        'data-science',
        'machine-learning',
        'visualization',
        'web',
        'utility'
      ];

      return {
        packages: filteredPackages,
        total: filteredPackages.length,
        categories
      };

    } catch (error) {
      server.log.error('Error listing packages:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list packages'
      });
    }
  });

  // Get package details
  server.get('/:packageName', {
    schema: {
      params: Type.Object({
        packageName: Type.String()
      }),
      response: {
        200: Type.Object({
          name: Type.String(),
          version: Type.String(),
          description: Type.String(),
          author: Type.Optional(Type.String()),
          license: Type.Optional(Type.String()),
          homepage: Type.Optional(Type.String()),
          repository: Type.Optional(Type.String()),
          dependencies: Type.Array(Type.String()),
          size: Type.Number(),
          installed: Type.Boolean(),
          allowedVersions: Type.Array(Type.String()),
          securityRating: Type.Union([
            Type.Literal('safe'),
            Type.Literal('caution'),
            Type.Literal('restricted'),
            Type.Literal('blocked')
          ]),
          category: Type.String()
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { packageName } = request.params;

    try {
      const packageInfo = await getPackageInfo(packageName);
      
      if (!packageInfo) {
        return reply.status(404).send({
          error: 'Package Not Found',
          message: `Package '${packageName}' not found`
        });
      }

      return packageInfo;

    } catch (error) {
      server.log.error('Error getting package info:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get package information'
      });
    }
  });

  // Install packages
  server.post('/install', {
    schema: {
      body: InstallRequestSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          installed: Type.Array(Type.String()),
          failed: Type.Array(Type.Object({
            package: Type.String(),
            error: Type.String()
          })),
          logs: Type.Array(Type.String())
        }),
        400: Type.Object({
          error: Type.String(),
          message: Type.String()
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { packages, sessionId, force = false } = request.body;

    try {
      // Check if session exists
      const session = await server.executor.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      // Validate packages against security policy
      const allowedPackages = await validatePackagesForInstallation(packages);
      if (allowedPackages.blocked.length > 0) {
        return reply.status(400).send({
          error: 'Security Violation',
          message: `Blocked packages: ${allowedPackages.blocked.join(', ')}`
        });
      }

      // Install packages in the session's container
      const installResult = await installPackagesInContainer(
        session.containerName,
        allowedPackages.allowed,
        force
      );

      return installResult;

    } catch (error) {
      server.log.error('Package installation error:', error);
      
      return reply.status(500).send({
        error: 'Installation Error',
        message: error.message
      });
    }
  });

  // Uninstall packages
  server.post('/uninstall', {
    schema: {
      body: UninstallRequestSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          uninstalled: Type.Array(Type.String()),
          failed: Type.Array(Type.Object({
            package: Type.String(),
            error: Type.String()
          })),
          logs: Type.Array(Type.String())
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { packages, sessionId } = request.body;

    try {
      // Check if session exists
      const session = await server.executor.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      // Uninstall packages from the session's container
      const uninstallResult = await uninstallPackagesFromContainer(
        session.containerName,
        packages
      );

      return uninstallResult;

    } catch (error) {
      server.log.error('Package uninstallation error:', error);
      
      return reply.status(500).send({
        error: 'Uninstallation Error',
        message: error.message
      });
    }
  });

  // List installed packages in a session
  server.get('/session/:sessionId', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          sessionId: Type.String(),
          packages: Type.Array(PackageSchema)
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      const installedPackages = await getInstalledPackagesInContainer(session.containerName);

      return {
        sessionId,
        packages: installedPackages
      };

    } catch (error) {
      server.log.error('Error listing session packages:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list session packages'
      });
    }
  });
};

// Helper functions
async function getAvailablePackages(): Promise<Array<{
  name: string;
  version: string;
  description?: string;
  installed: boolean;
  size?: number;
  dependencies?: string[];
}>> {
  // This would typically query a package registry or cache
  return [
    {
      name: 'numpy',
      version: '1.24.3',
      description: 'Fundamental package for scientific computing',
      installed: true,
      size: 15000000,
      dependencies: []
    },
    {
      name: 'pandas',
      version: '2.0.3',
      description: 'Data analysis and manipulation library',
      installed: true,
      size: 30000000,
      dependencies: ['numpy', 'python-dateutil', 'pytz']
    },
    {
      name: 'matplotlib',
      version: '3.7.2',
      description: 'Plotting library',
      installed: true,
      size: 25000000,
      dependencies: ['numpy']
    },
    {
      name: 'requests',
      version: '2.31.0',
      description: 'HTTP library',
      installed: false,
      size: 500000,
      dependencies: ['urllib3', 'certifi']
    }
  ];
}

async function getPackageInfo(packageName: string) {
  // This would query detailed package information
  const packages = await getAvailablePackages();
  const pkg = packages.find(p => p.name === packageName);
  
  if (!pkg) return null;

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description || '',
    author: 'Package Author',
    license: 'MIT',
    homepage: `https://pypi.org/project/${pkg.name}/`,
    repository: `https://github.com/project/${pkg.name}`,
    dependencies: pkg.dependencies || [],
    size: pkg.size || 0,
    installed: pkg.installed,
    allowedVersions: [pkg.version],
    securityRating: getPackageSecurityRating(pkg.name),
    category: getPackageCategory(pkg.name)
  };
}

function getPackageCategory(packageName: string): string {
  const categories: Record<string, string> = {
    'numpy': 'data-science',
    'pandas': 'data-science',
    'scipy': 'data-science',
    'matplotlib': 'visualization',
    'seaborn': 'visualization',
    'plotly': 'visualization',
    'sklearn': 'machine-learning',
    'tensorflow': 'machine-learning',
    'torch': 'machine-learning',
    'requests': 'web',
    'flask': 'web',
    'django': 'web'
  };

  return categories[packageName] || 'utility';
}

function getPackageSecurityRating(packageName: string): 'safe' | 'caution' | 'restricted' | 'blocked' {
  const securityRatings: Record<string, 'safe' | 'caution' | 'restricted' | 'blocked'> = {
    'numpy': 'safe',
    'pandas': 'safe',
    'matplotlib': 'safe',
    'requests': 'caution', // Network access
    'os': 'blocked',
    'subprocess': 'blocked',
    'socket': 'blocked'
  };

  return securityRatings[packageName] || 'caution';
}

async function validatePackagesForInstallation(packages: string[]): Promise<{
  allowed: string[];
  blocked: string[];
  warnings: string[];
}> {
  const allowed: string[] = [];
  const blocked: string[] = [];
  const warnings: string[] = [];

  for (const packageName of packages) {
    const rating = getPackageSecurityRating(packageName);
    
    switch (rating) {
      case 'safe':
        allowed.push(packageName);
        break;
      case 'caution':
        allowed.push(packageName);
        warnings.push(`Package '${packageName}' requires caution due to potential security implications`);
        break;
      case 'restricted':
        warnings.push(`Package '${packageName}' has restrictions`);
        allowed.push(packageName);
        break;
      case 'blocked':
        blocked.push(packageName);
        break;
    }
  }

  return { allowed, blocked, warnings };
}

async function installPackagesInContainer(
  containerName: string,
  packages: string[],
  force: boolean
): Promise<{
  success: boolean;
  installed: string[];
  failed: Array<{ package: string; error: string }>;
  logs: string[];
}> {
  const installed: string[] = [];
  const failed: Array<{ package: string; error: string }> = [];
  const logs: string[] = [];

  for (const packageName of packages) {
    try {
      const result = await installSinglePackage(containerName, packageName, force);
      if (result.success) {
        installed.push(packageName);
        logs.push(...result.logs);
      } else {
        failed.push({ package: packageName, error: result.error });
      }
    } catch (error) {
      failed.push({ package: packageName, error: error.message });
    }
  }

  return {
    success: failed.length === 0,
    installed,
    failed,
    logs
  };
}

async function installSinglePackage(
  containerName: string,
  packageName: string,
  force: boolean
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  return new Promise((resolve) => {
    const args = ['exec', containerName, 'pip', 'install'];
    if (force) args.push('--force-reinstall');
    args.push(packageName);

    const process = spawn('docker', args);
    const logs: string[] = [];

    process.stdout?.on('data', (data) => {
      logs.push(data.toString());
    });

    process.stderr?.on('data', (data) => {
      logs.push(data.toString());
    });

    process.on('close', (code) => {
      resolve({
        success: code === 0,
        error: code !== 0 ? `Installation failed with exit code ${code}` : undefined,
        logs
      });
    });
  });
}

async function uninstallPackagesFromContainer(
  containerName: string,
  packages: string[]
): Promise<{
  success: boolean;
  uninstalled: string[];
  failed: Array<{ package: string; error: string }>;
  logs: string[];
}> {
  const uninstalled: string[] = [];
  const failed: Array<{ package: string; error: string }> = [];
  const logs: string[] = [];

  for (const packageName of packages) {
    try {
      const result = await uninstallSinglePackage(containerName, packageName);
      if (result.success) {
        uninstalled.push(packageName);
        logs.push(...result.logs);
      } else {
        failed.push({ package: packageName, error: result.error });
      }
    } catch (error) {
      failed.push({ package: packageName, error: error.message });
    }
  }

  return {
    success: failed.length === 0,
    uninstalled,
    failed,
    logs
  };
}

async function uninstallSinglePackage(
  containerName: string,
  packageName: string
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['exec', containerName, 'pip', 'uninstall', '-y', packageName]);
    const logs: string[] = [];

    process.stdout?.on('data', (data) => {
      logs.push(data.toString());
    });

    process.stderr?.on('data', (data) => {
      logs.push(data.toString());
    });

    process.on('close', (code) => {
      resolve({
        success: code === 0,
        error: code !== 0 ? `Uninstallation failed with exit code ${code}` : undefined,
        logs
      });
    });
  });
}

async function getInstalledPackagesInContainer(containerName: string): Promise<Array<{
  name: string;
  version: string;
  description?: string;
  installed: boolean;
  size?: number;
  dependencies?: string[];
}>> {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', ['exec', containerName, 'pip', 'list', '--format=json']);
    let output = '';

    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const packages = JSON.parse(output);
          resolve(packages.map((pkg: any) => ({
            name: pkg.name,
            version: pkg.version,
            installed: true
          })));
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Failed to list packages: exit code ${code}`));
      }
    });
  });
}

export default packagesRoute;