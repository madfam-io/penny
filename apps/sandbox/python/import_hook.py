"""
Import Hook - Secure import mechanism for sandbox environment
Controls module imports and access to prevent security violations
"""

import sys
import importlib
import importlib.util
from types import ModuleType
from typing import Optional, List, Any, Set
from importlib.machinery import ModuleSpec
from importlib.abc import MetaPathFinder, Loader

from sandbox_env import SandboxEnvironment


class SandboxModuleLoader(Loader):
    """Custom loader that filters module attributes based on security policy"""
    
    def __init__(self, spec: ModuleSpec, environment: SandboxEnvironment):
        self.spec = spec
        self.environment = environment
        self.original_loader = spec.loader
        
    def create_module(self, spec: ModuleSpec) -> Optional[ModuleType]:
        """Create module using original loader"""
        if self.original_loader and hasattr(self.original_loader, 'create_module'):
            return self.original_loader.create_module(spec)
        return None
        
    def exec_module(self, module: ModuleType) -> None:
        """Execute module and apply security filtering"""
        if self.original_loader and hasattr(self.original_loader, 'exec_module'):
            # Load the module normally first
            self.original_loader.exec_module(module)
            
            # Apply attribute filtering
            filtered_module = self.environment.filter_module_attributes(
                module, self.spec.name
            )
            
            # Replace module attributes with filtered ones
            module.__dict__.clear()
            module.__dict__.update(filtered_module.__dict__)


class ImportHook(MetaPathFinder):
    """Meta path finder that controls imports in sandbox environment"""
    
    def __init__(self):
        self.environment = SandboxEnvironment()
        self.import_cache = {}  # Cache for imported modules
        self.import_count = 0   # Track number of imports
        self.max_imports = 100  # Limit number of imports
        
        # Tracking for debugging
        self.attempted_imports = []
        self.blocked_imports = []
        
    def find_spec(self, fullname: str, path: Optional[List[str]], target: Optional[ModuleType] = None) -> Optional[ModuleSpec]:
        """Find module spec with security checks"""
        self.import_count += 1
        self.attempted_imports.append(fullname)
        
        # Check import limits
        if self.import_count > self.max_imports:
            raise ImportError(f"Import limit exceeded: {self.max_imports}")
        
        # Check if module is allowed
        if not self.environment.is_module_allowed(fullname):
            self.blocked_imports.append(fullname)
            raise ImportError(f"Import of '{fullname}' is not allowed in sandbox environment")
            
        # Check cache first
        if fullname in self.import_cache:
            return self.import_cache[fullname]
            
        # Find the original spec using default finders
        spec = None
        for finder in sys.meta_path:
            if finder is self:  # Skip ourselves
                continue
                
            if hasattr(finder, 'find_spec'):
                spec = finder.find_spec(fullname, path, target)
                if spec is not None:
                    break
                    
        if spec is None:
            return None
            
        # Wrap loader with our security filtering
        if spec.loader is not None:
            spec.loader = SandboxModuleLoader(spec, self.environment)
            
        # Cache the spec
        self.import_cache[fullname] = spec
        
        return spec
        
    def find_module(self, fullname: str, path: Optional[List[str]] = None) -> Optional[Loader]:
        """Legacy find_module method (for compatibility)"""
        spec = self.find_spec(fullname, path)
        return spec.loader if spec else None
        
    def get_import_stats(self) -> dict:
        """Get statistics about imports"""
        return {
            'total_attempts': len(self.attempted_imports),
            'blocked_count': len(self.blocked_imports),
            'allowed_count': len(self.attempted_imports) - len(self.blocked_imports),
            'attempted_imports': self.attempted_imports.copy(),
            'blocked_imports': self.blocked_imports.copy(),
            'cached_modules': list(self.import_cache.keys())
        }
        
    def clear_cache(self):
        """Clear import cache"""
        self.import_cache.clear()
        
    def reset_counters(self):
        """Reset import counters and tracking"""
        self.import_count = 0
        self.attempted_imports.clear()
        self.blocked_imports.clear()


class RestrictedBuiltins:
    """Replacement for __builtins__ with restricted functionality"""
    
    def __init__(self, environment: SandboxEnvironment):
        self.environment = environment
        self._setup_restricted_builtins()
        
    def _setup_restricted_builtins(self):
        """Setup restricted versions of builtin functions"""
        # Get allowed builtins from environment
        allowed = self.environment.allowed_builtins
        
        # Copy allowed builtins
        import builtins
        for name in allowed:
            if hasattr(builtins, name):
                setattr(self, name, getattr(builtins, name))
                
        # Add custom restricted functions
        self.__import__ = self._restricted_import
        self.open = self.environment.create_safe_open()
        self.print = self.environment.create_safe_print()
        
    def _restricted_import(self, name, globals=None, locals=None, fromlist=(), level=0):
        """Restricted version of __import__"""
        # This will go through our ImportHook
        return __import__(name, globals, locals, fromlist, level)
        
    def __getattr__(self, name):
        """Handle access to non-existent attributes"""
        raise AttributeError(f"'{name}' is not available in sandbox environment")


def patch_import_system(environment: SandboxEnvironment = None):
    """Patch the import system to use our security hooks"""
    if environment is None:
        environment = SandboxEnvironment()
        
    # Install our import hook at the beginning of meta_path
    hook = ImportHook()
    if hook not in sys.meta_path:
        sys.meta_path.insert(0, hook)
        
    return hook


def unpatch_import_system(hook: ImportHook):
    """Remove our import hook from the system"""
    if hook in sys.meta_path:
        sys.meta_path.remove(hook)


class SafeImporter:
    """High-level interface for safe importing in sandbox"""
    
    def __init__(self):
        self.environment = SandboxEnvironment()
        self.hook = None
        
    def __enter__(self):
        """Install import hook"""
        self.hook = patch_import_system(self.environment)
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Remove import hook"""
        if self.hook:
            unpatch_import_system(self.hook)
            
    def safe_import(self, module_name: str, fromlist: List[str] = None) -> ModuleType:
        """Safely import a module with security checks"""
        if not self.environment.is_module_allowed(module_name):
            raise ImportError(f"Module '{module_name}' is not allowed")
            
        try:
            if fromlist:
                module = __import__(module_name, fromlist=fromlist)
                # Filter attributes based on fromlist
                filtered_attrs = {}
                allowed_attrs = self.environment.get_allowed_attributes(module_name)
                
                for attr_name in fromlist:
                    if allowed_attrs is None or attr_name in allowed_attrs:
                        if hasattr(module, attr_name):
                            filtered_attrs[attr_name] = getattr(module, attr_name)
                            
                return type('Module', (), filtered_attrs)
            else:
                return __import__(module_name)
                
        except ImportError as e:
            raise ImportError(f"Failed to import '{module_name}': {e}")
            
    def get_import_stats(self) -> dict:
        """Get import statistics"""
        if self.hook:
            return self.hook.get_import_stats()
        return {}


def create_safe_globals_with_imports():
    """Create safe globals dictionary with import restrictions"""
    env = SandboxEnvironment()
    safe_globals = env.get_safe_globals()
    
    # Replace __import__ with restricted version
    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        if not env.is_module_allowed(name):
            raise ImportError(f"Import of '{name}' is not allowed in sandbox")
        return __import__(name, globals, locals, fromlist, level)
        
    safe_globals['__builtins__']['__import__'] = safe_import
    
    return safe_globals


if __name__ == '__main__':
    # Test the import hook
    print("Testing ImportHook...")
    
    with SafeImporter() as importer:
        print("\n1. Testing allowed import:")
        try:
            math_module = importer.safe_import('math')
            print(f"Successfully imported math: {math_module}")
        except ImportError as e:
            print(f"Failed to import math: {e}")
            
        print("\n2. Testing blocked import:")
        try:
            os_module = importer.safe_import('os')
            print(f"Successfully imported os: {os_module}")
        except ImportError as e:
            print(f"Correctly blocked os import: {e}")
            
        print("\n3. Testing fromlist import:")
        try:
            sqrt = importer.safe_import('math', ['sqrt'])
            print(f"Successfully imported sqrt from math: {sqrt}")
        except ImportError as e:
            print(f"Failed to import sqrt: {e}")
            
        print("\n4. Import statistics:")
        stats = importer.get_import_stats()
        for key, value in stats.items():
            print(f"  {key}: {value}")
            
    print("\nImport hook test completed.")