"""
Sandbox Environment - Secure execution environment setup
Provides safe globals and restricted module access
"""

import sys
import os
import builtins
from types import ModuleType
from typing import Dict, Any, Set, Optional, List
import importlib
import warnings

class SandboxEnvironment:
    """Manages the secure execution environment for sandbox code"""
    
    def __init__(self):
        # Allowed modules and their allowed attributes
        self.allowed_modules = {
            # Core Python modules
            'math': ['*'],
            'random': ['random', 'randint', 'uniform', 'choice', 'shuffle', 'seed'],
            'datetime': ['*'],
            'time': ['time', 'sleep'],
            'json': ['loads', 'dumps'],
            're': ['*'],
            'string': ['*'],
            'collections': ['*'],
            'itertools': ['*'],
            'functools': ['*'],
            'operator': ['*'],
            'copy': ['copy', 'deepcopy'],
            'decimal': ['*'],
            'fractions': ['*'],
            'statistics': ['*'],
            
            # Data science modules
            'numpy': ['*'],
            'pandas': ['*'],
            'matplotlib': ['*'],
            'matplotlib.pyplot': ['*'],
            'seaborn': ['*'],
            'plotly': ['*'],
            'scipy': ['*'],
            'sklearn': ['*'],
            'PIL': ['*'],
            
            # Utility modules
            'base64': ['b64encode', 'b64decode'],
            'hashlib': ['md5', 'sha1', 'sha256'],
            'uuid': ['*'],
            'urllib.parse': ['*'],
            'textwrap': ['*'],
            'pprint': ['pprint', 'pformat'],
        }
        
        # Completely blocked modules
        self.blocked_modules = {
            'os', 'sys', 'subprocess', 'shutil', 'glob', 'pathlib',
            'socket', 'urllib.request', 'urllib.error', 'http',
            'smtplib', 'poplib', 'imaplib', 'ftplib',
            'threading', 'multiprocessing', '_thread',
            'ctypes', 'ctypes.util', 'ctypes.wintypes',
            'importlib', 'pkgutil', 'modulefinder',
            'ast', 'code', 'codeop', 'compile', 'dis',
            'gc', 'inspect', 'types', 'weakref',
            'pickle', 'marshal', 'shelve', 'dbm'
        }
        
        # Allowed builtins (restricted set)
        self.allowed_builtins = {
            # Types and constructors
            'int', 'float', 'str', 'bool', 'list', 'tuple', 'dict', 'set',
            'complex', 'bytes', 'bytearray', 'frozenset',
            
            # Functions
            'len', 'range', 'enumerate', 'zip', 'map', 'filter',
            'sorted', 'reversed', 'sum', 'min', 'max', 'abs',
            'round', 'pow', 'divmod', 'hash', 'id', 'type',
            'isinstance', 'issubclass', 'hasattr', 'getattr',
            'setattr', 'delattr', 'callable',
            
            # Iteration
            'iter', 'next', 'all', 'any',
            
            # String/repr functions
            'repr', 'str', 'format', 'ord', 'chr', 'hex', 'oct', 'bin',
            
            # Exception handling
            'Exception', 'ValueError', 'TypeError', 'KeyError',
            'IndexError', 'AttributeError', 'ImportError',
            'RuntimeError', 'ZeroDivisionError', 'OverflowError',
            
            # Constants
            'True', 'False', 'None', 'NotImplemented', 'Ellipsis',
            
            # I/O (restricted)
            'print',  # Allowed for output
        }
        
        # Preload safe modules to avoid import issues
        self.preloaded_modules = {}
        self._preload_safe_modules()
        
    def _preload_safe_modules(self):
        """Preload commonly used safe modules"""
        safe_to_preload = ['math', 'random', 'datetime', 'json', 're']
        
        for module_name in safe_to_preload:
            try:
                module = importlib.import_module(module_name)
                self.preloaded_modules[module_name] = module
            except ImportError:
                pass
                
    def get_safe_globals(self) -> Dict[str, Any]:
        """Get a safe globals dictionary for code execution"""
        safe_globals = {'__builtins__': {}}
        
        # Add allowed builtins
        for name in self.allowed_builtins:
            if hasattr(builtins, name):
                safe_globals['__builtins__'][name] = getattr(builtins, name)
                
        # Add preloaded modules
        for name, module in self.preloaded_modules.items():
            safe_globals[name] = module
            
        # Add safe constants
        safe_globals.update({
            '__name__': '__sandbox__',
            '__doc__': None,
        })
        
        return safe_globals
        
    def is_module_allowed(self, module_name: str) -> bool:
        """Check if a module is allowed to be imported"""
        # Check if module is explicitly blocked
        if module_name in self.blocked_modules:
            return False
            
        # Check if module is explicitly allowed
        if module_name in self.allowed_modules:
            return True
            
        # Check parent modules
        parts = module_name.split('.')
        for i in range(len(parts)):
            parent_module = '.'.join(parts[:i+1])
            if parent_module in self.blocked_modules:
                return False
            if parent_module in self.allowed_modules:
                return True
                
        # Default to block unknown modules
        return False
        
    def get_allowed_attributes(self, module_name: str) -> Optional[List[str]]:
        """Get allowed attributes for a module"""
        if module_name in self.allowed_modules:
            attrs = self.allowed_modules[module_name]
            return None if '*' in attrs else attrs
        return None
        
    def filter_module_attributes(self, module: ModuleType, module_name: str) -> ModuleType:
        """Filter module attributes based on allowed list"""
        allowed_attrs = self.get_allowed_attributes(module_name)
        
        if allowed_attrs is None:  # '*' means all attributes allowed
            return module
            
        # Create a filtered module
        filtered_module = ModuleType(module_name)
        
        for attr_name in allowed_attrs:
            if hasattr(module, attr_name):
                setattr(filtered_module, attr_name, getattr(module, attr_name))
                
        return filtered_module
        
    def create_safe_open(self):
        """Create a safe version of open() that restricts file access"""
        def safe_open(filename, mode='r', **kwargs):
            # Only allow reading from specific directories
            allowed_dirs = ['/tmp', '/workspace', '/sandbox/data']
            
            # Resolve absolute path
            abs_path = os.path.abspath(filename)
            
            # Check if path is in allowed directories
            allowed = any(abs_path.startswith(allowed_dir) for allowed_dir in allowed_dirs)
            
            if not allowed:
                raise PermissionError(f"Access denied to file: {filename}")
                
            # Only allow safe modes
            safe_modes = ['r', 'rb', 'w', 'wb', 'a', 'ab']
            if mode not in safe_modes:
                raise ValueError(f"File mode '{mode}' not allowed")
                
            # Limit file size for writing
            if 'w' in mode or 'a' in mode:
                kwargs['buffering'] = kwargs.get('buffering', 8192)  # Limit buffer size
                
            return open(filename, mode, **kwargs)
            
        return safe_open
        
    def create_safe_print(self):
        """Create a safe version of print() that limits output"""
        original_print = builtins.print
        
        def safe_print(*args, **kwargs):
            # Limit output size
            output = ' '.join(str(arg) for arg in args)
            if len(output) > 10000:  # 10KB limit
                output = output[:10000] + '... [output truncated]'
                args = (output,)
                
            return original_print(*args, **kwargs)
            
        return safe_print
        
    def setup_matplotlib_backend(self):
        """Setup matplotlib for safe plotting in sandbox"""
        try:
            import matplotlib
            matplotlib.use('Agg')  # Use non-interactive backend
            
            import matplotlib.pyplot as plt
            
            # Override show() to save plots instead
            original_show = plt.show
            
            def safe_show(block=None):
                # Save plot to file instead of displaying
                import uuid
                plot_id = str(uuid.uuid4())
                plot_path = f'/tmp/plots/plot_{plot_id}.png'
                
                try:
                    os.makedirs('/tmp/plots', exist_ok=True)
                    plt.savefig(plot_path, dpi=100, bbox_inches='tight')
                    print(f"Plot saved: {plot_path}")
                except Exception as e:
                    print(f"Error saving plot: {e}")
                    
            plt.show = safe_show
            
        except ImportError:
            pass  # matplotlib not available
            
    def setup_pandas_display(self):
        """Setup pandas for safe display in sandbox"""
        try:
            import pandas as pd
            
            # Limit display options
            pd.set_option('display.max_rows', 100)
            pd.set_option('display.max_columns', 20)
            pd.set_option('display.width', 120)
            pd.set_option('display.max_colwidth', 50)
            
        except ImportError:
            pass  # pandas not available
            
    def initialize_environment(self):
        """Initialize the complete sandbox environment"""
        # Setup safe matplotlib backend
        self.setup_matplotlib_backend()
        
        # Setup pandas display options
        self.setup_pandas_display()
        
        # Suppress warnings
        warnings.filterwarnings('ignore')
        
        # Set environment variables
        os.environ['MPLBACKEND'] = 'Agg'
        os.environ['PYTHONPATH'] = '/sandbox/python:/workspace'
        
    def get_environment_info(self) -> Dict[str, Any]:
        """Get information about the sandbox environment"""
        return {
            'allowed_modules': list(self.allowed_modules.keys()),
            'blocked_modules': list(self.blocked_modules),
            'allowed_builtins': list(self.allowed_builtins),
            'preloaded_modules': list(self.preloaded_modules.keys()),
            'python_version': sys.version,
            'platform': sys.platform,
        }
        
    def validate_code_safety(self, code: str) -> Dict[str, Any]:
        """Validate code for safety before execution"""
        issues = []
        
        # Check for dangerous patterns
        dangerous_patterns = [
            ('eval(', 'Dynamic code evaluation'),
            ('exec(', 'Dynamic code execution'), 
            ('__import__(', 'Dynamic imports'),
            ('compile(', 'Code compilation'),
            ('open(', 'File access'),
            ('file(', 'File access'),
            ('subprocess', 'Subprocess execution'),
            ('os.system', 'System commands'),
            ('socket.', 'Network access'),
            ('urllib.', 'Network access'),
            ('requests.', 'Network requests'),
        ]
        
        for pattern, description in dangerous_patterns:
            if pattern in code:
                issues.append({
                    'type': 'warning',
                    'pattern': pattern,
                    'description': description
                })
                
        # Check for blocked modules in imports
        import re
        import_pattern = r'(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)'
        imports = re.findall(import_pattern, code)
        
        for module_name in imports:
            if not self.is_module_allowed(module_name):
                issues.append({
                    'type': 'error',
                    'pattern': f'import {module_name}',
                    'description': f'Module {module_name} is not allowed'
                })
                
        return {
            'safe': len([i for i in issues if i['type'] == 'error']) == 0,
            'issues': issues
        }


# Global environment instance
_environment_instance = None

def get_sandbox_environment() -> SandboxEnvironment:
    """Get the global sandbox environment instance"""
    global _environment_instance
    if _environment_instance is None:
        _environment_instance = SandboxEnvironment()
        _environment_instance.initialize_environment()
    return _environment_instance


if __name__ == '__main__':
    # Test the environment
    env = SandboxEnvironment()
    env.initialize_environment()
    
    print("Sandbox Environment Info:")
    info = env.get_environment_info()
    for key, value in info.items():
        print(f"{key}: {value}")
        
    print("\nTesting code validation:")
    test_codes = [
        "import numpy as np\nprint('Hello')",
        "import os\nos.system('ls')",
        "eval('print(123)')",
        "import requests\nrequests.get('http://example.com')"
    ]
    
    for code in test_codes:
        result = env.validate_code_safety(code)
        print(f"\nCode: {code}")
        print(f"Safe: {result['safe']}")
        if result['issues']:
            for issue in result['issues']:
                print(f"  {issue['type']}: {issue['description']}")