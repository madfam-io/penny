"""
Sandbox Runtime - Main Python execution environment
Provides secure execution context with resource monitoring and output capture
"""

import sys
import os
import signal
import resource
import threading
import time
import traceback
import json
import pickle
from typing import Dict, Any, Optional, List
from contextlib import contextmanager
from io import StringIO, BytesIO
import warnings

from sandbox_env import SandboxEnvironment
from import_hook import ImportHook
from output_handler import OutputHandler

class SandboxRuntime:
    """Main runtime environment for sandbox code execution"""
    
    def __init__(self):
        self.environment = SandboxEnvironment()
        self.import_hook = ImportHook()
        self.output_handler = OutputHandler()
        self.session_vars = {}
        
        # Resource limits
        self.max_memory = 512 * 1024 * 1024  # 512MB
        self.max_cpu_time = 30  # 30 seconds
        self.max_output_size = 10 * 1024 * 1024  # 10MB
        
        # Execution state
        self.is_executing = False
        self.execution_thread = None
        self.start_time = None
        
        # Install security hooks
        self._install_security_hooks()
        
    def _install_security_hooks(self):
        """Install security hooks and restrictions"""
        # Install import hook
        sys.meta_path.insert(0, self.import_hook)
        
        # Set resource limits
        try:
            # Memory limit
            resource.setrlimit(resource.RLIMIT_AS, (self.max_memory, self.max_memory))
            
            # CPU time limit  
            resource.setrlimit(resource.RLIMIT_CPU, (self.max_cpu_time, self.max_cpu_time))
            
            # File size limit (10MB)
            resource.setrlimit(resource.RLIMIT_FSIZE, (10*1024*1024, 10*1024*1024))
            
        except (OSError, ValueError) as e:
            print(f"Warning: Could not set resource limits: {e}")
        
        # Install signal handlers
        signal.signal(signal.SIGALRM, self._timeout_handler)
        signal.signal(signal.SIGTERM, self._termination_handler)
        
        # Restrict dangerous builtins
        self._restrict_builtins()
        
    def _restrict_builtins(self):
        """Restrict access to dangerous builtin functions"""
        dangerous_builtins = [
            'eval', 'exec', 'compile', '__import__',
            'open', 'file', 'input', 'raw_input',
            'reload', 'vars', 'dir', 'globals', 'locals'
        ]
        
        # Store original builtins for restoration
        self.original_builtins = {}
        
        for name in dangerous_builtins:
            if hasattr(__builtins__, name):
                self.original_builtins[name] = getattr(__builtins__, name)
                setattr(__builtins__, name, self._restricted_builtin(name))
                
    def _restricted_builtin(self, name: str):
        """Create a restricted version of a builtin function"""
        def restricted(*args, **kwargs):
            raise SecurityError(f"Access to '{name}' is restricted in sandbox environment")
        return restricted
        
    def _timeout_handler(self, signum, frame):
        """Handle execution timeout"""
        raise TimeoutError("Code execution timeout")
        
    def _termination_handler(self, signum, frame):
        """Handle termination signal"""
        raise KeyboardInterrupt("Execution terminated")
        
    @contextmanager
    def execution_context(self, timeout: Optional[int] = None):
        """Context manager for safe code execution"""
        if timeout is None:
            timeout = self.max_cpu_time
            
        self.is_executing = True
        self.start_time = time.time()
        
        # Set alarm for timeout
        signal.alarm(timeout)
        
        # Capture stdout/stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        
        stdout_buffer = StringIO()
        stderr_buffer = StringIO()
        
        sys.stdout = stdout_buffer
        sys.stderr = stderr_buffer
        
        try:
            yield {
                'stdout': stdout_buffer,
                'stderr': stderr_buffer,
                'environment': self.environment
            }
        finally:
            # Restore stdout/stderr
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            
            # Cancel alarm
            signal.alarm(0)
            
            self.is_executing = False
            
    def execute_code(self, code: str, session_id: str = None, variables: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute Python code in sandbox environment"""
        try:
            # Load session variables if provided
            if variables:
                self.session_vars.update(variables)
                
            # Prepare execution environment
            execution_globals = self.environment.get_safe_globals()
            execution_globals.update(self.session_vars)
            
            with self.execution_context() as context:
                stdout_buffer = context['stdout']
                stderr_buffer = context['stderr']
                
                # Execute the code
                try:
                    exec(code, execution_globals)
                    execution_success = True
                    execution_error = None
                    
                except Exception as e:
                    execution_success = False
                    execution_error = {
                        'type': type(e).__name__,
                        'message': str(e),
                        'traceback': traceback.format_exc()
                    }
                
                # Capture output
                stdout_output = stdout_buffer.getvalue()
                stderr_output = stderr_buffer.getvalue()
                
                # Extract variables (excluding built-ins and modules)
                user_variables = self._extract_user_variables(execution_globals)
                
                # Update session variables
                self.session_vars.update(user_variables)
                
                # Capture plots
                plots = self.output_handler.get_plots()
                
                return {
                    'success': execution_success,
                    'stdout': stdout_output,
                    'stderr': stderr_output,
                    'variables': self.output_handler.serialize_variables(user_variables),
                    'plots': plots,
                    'error': execution_error,
                    'execution_time': time.time() - self.start_time,
                    'memory_usage': self._get_memory_usage()
                }
                
        except TimeoutError:
            return {
                'success': False,
                'stdout': '',
                'stderr': '',
                'variables': {},
                'plots': [],
                'error': {
                    'type': 'TimeoutError',
                    'message': f'Code execution timeout after {self.max_cpu_time} seconds',
                    'traceback': ''
                }
            }
            
        except MemoryError:
            return {
                'success': False,
                'stdout': '',
                'stderr': '',
                'variables': {},
                'plots': [],
                'error': {
                    'type': 'MemoryError',
                    'message': f'Code execution exceeded memory limit of {self.max_memory} bytes',
                    'traceback': ''
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'stdout': '',
                'stderr': '',
                'variables': {},
                'plots': [],
                'error': {
                    'type': type(e).__name__,
                    'message': str(e),
                    'traceback': traceback.format_exc()
                }
            }
            
    def _extract_user_variables(self, execution_globals: Dict[str, Any]) -> Dict[str, Any]:
        """Extract user-defined variables from execution globals"""
        user_vars = {}
        
        # Skip built-in variables and modules
        skip_vars = {
            '__builtins__', '__name__', '__doc__', '__package__',
            '__loader__', '__spec__', '__annotations__', '__file__'
        }
        
        for name, value in execution_globals.items():
            if (not name.startswith('_') and 
                name not in skip_vars and
                not callable(value) and
                not hasattr(value, '__module__')):
                
                try:
                    # Only include serializable variables
                    json.dumps(value, default=str)
                    user_vars[name] = value
                except (TypeError, ValueError):
                    # Store string representation for non-serializable objects
                    user_vars[name] = str(value)
                    
        return user_vars
        
    def _get_memory_usage(self) -> int:
        """Get current memory usage in bytes"""
        try:
            return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
        except:
            return 0
            
    def load_session_variables(self, session_id: str) -> bool:
        """Load variables from session file"""
        try:
            session_file = f'/tmp/session_{session_id}_vars.pkl'
            if os.path.exists(session_file):
                with open(session_file, 'rb') as f:
                    self.session_vars = pickle.load(f)
                return True
        except Exception as e:
            print(f"Warning: Could not load session variables: {e}")
        return False
        
    def save_session_variables(self, session_id: str) -> bool:
        """Save variables to session file"""
        try:
            session_file = f'/tmp/session_{session_id}_vars.pkl'
            with open(session_file, 'wb') as f:
                pickle.dump(self.session_vars, f)
            return True
        except Exception as e:
            print(f"Warning: Could not save session variables: {e}")
        return False
        
    def clear_session_variables(self, session_id: str = None):
        """Clear session variables"""
        self.session_vars.clear()
        if session_id:
            session_file = f'/tmp/session_{session_id}_vars.pkl'
            try:
                if os.path.exists(session_file):
                    os.remove(session_file)
            except Exception:
                pass
                
    def get_session_info(self) -> Dict[str, Any]:
        """Get information about current session"""
        return {
            'variable_count': len(self.session_vars),
            'variables': list(self.session_vars.keys()),
            'memory_usage': self._get_memory_usage(),
            'is_executing': self.is_executing
        }
        
    def install_package(self, package_name: str) -> bool:
        """Install a package (if allowed)"""
        # This would typically be handled by the container
        # For now, just check if package is already available
        try:
            __import__(package_name)
            return True
        except ImportError:
            return False
            
    def cleanup(self):
        """Cleanup runtime resources"""
        # Cancel any active alarm
        signal.alarm(0)
        
        # Restore original builtins
        for name, func in self.original_builtins.items():
            setattr(__builtins__, name, func)
            
        # Remove import hook
        if self.import_hook in sys.meta_path:
            sys.meta_path.remove(self.import_hook)
            
        # Clear session variables
        self.session_vars.clear()


class SecurityError(Exception):
    """Exception raised for security violations"""
    pass


# Global runtime instance
_runtime_instance = None

def get_runtime() -> SandboxRuntime:
    """Get the global runtime instance"""
    global _runtime_instance
    if _runtime_instance is None:
        _runtime_instance = SandboxRuntime()
    return _runtime_instance


def execute_user_code(code: str, session_id: str = None, variables: Dict[str, Any] = None) -> Dict[str, Any]:
    """Convenience function to execute user code"""
    runtime = get_runtime()
    return runtime.execute_code(code, session_id, variables)


if __name__ == '__main__':
    # Example usage
    runtime = SandboxRuntime()
    
    test_code = """
import numpy as np
import matplotlib.pyplot as plt

# Create some data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create a plot
plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)

# Print some info
print(f"Generated {len(x)} data points")
print(f"Max value: {np.max(y):.3f}")
print(f"Min value: {np.min(y):.3f}")

# Store some variables
data_points = len(x)
max_value = float(np.max(y))
min_value = float(np.min(y))
"""
    
    result = runtime.execute_code(test_code)
    print(json.dumps(result, indent=2, default=str))