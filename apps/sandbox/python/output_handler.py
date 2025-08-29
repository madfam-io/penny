"""
Output Handler - Manages output capture, streaming, and serialization
Handles matplotlib plots, pandas DataFrames, and variable inspection
"""

import sys
import os
import json
import base64
import io
import uuid
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, date
import traceback

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    import matplotlib
    import matplotlib.pyplot as plt
    from matplotlib.figure import Figure
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


class OutputHandler:
    """Handles all output processing in the sandbox environment"""
    
    def __init__(self):
        self.plots = []
        self.max_plot_size = 5 * 1024 * 1024  # 5MB per plot
        self.max_plots = 20
        self.max_variable_size = 1024 * 1024  # 1MB for variable serialization
        
        # Setup matplotlib if available
        if HAS_MATPLOTLIB:
            self._setup_matplotlib()
            
    def _setup_matplotlib(self):
        """Setup matplotlib for sandbox environment"""
        matplotlib.use('Agg')  # Non-interactive backend
        
        # Override plt.show to capture plots
        original_show = plt.show
        original_savefig = plt.savefig
        
        def capture_show(block=None):
            """Capture plots when show() is called"""
            self._capture_current_plots()
            plt.close('all')  # Close all figures after capturing
            
        def capture_savefig(fname, **kwargs):
            """Capture plots when savefig() is called"""
            # Call original savefig
            result = original_savefig(fname, **kwargs)
            # Also capture for our system
            self._capture_current_plots()
            return result
            
        plt.show = capture_show
        plt.savefig = capture_savefig
        
    def _capture_current_plots(self):
        """Capture all currently open matplotlib figures"""
        if not HAS_MATPLOTLIB:
            return
            
        for fig_num in plt.get_fignums():
            try:
                fig = plt.figure(fig_num)
                plot_data = self._figure_to_data(fig)
                if plot_data:
                    self.plots.append(plot_data)
                    
                # Limit number of plots
                if len(self.plots) > self.max_plots:
                    self.plots.pop(0)
                    
            except Exception as e:
                print(f"Error capturing plot {fig_num}: {e}")
                
    def _figure_to_data(self, fig: 'Figure') -> Optional[Dict[str, Any]]:
        """Convert matplotlib figure to data dictionary"""
        try:
            # Create buffer to save plot
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            
            # Encode as base64
            plot_data = buf.getvalue()
            if len(plot_data) > self.max_plot_size:
                print(f"Warning: Plot size ({len(plot_data)} bytes) exceeds limit")
                return None
                
            b64_data = base64.b64encode(plot_data).decode('utf-8')
            
            # Extract metadata
            metadata = {
                'width': fig.get_figwidth(),
                'height': fig.get_figheight(),
                'dpi': fig.dpi,
                'title': '',
                'xlabel': '',
                'ylabel': ''
            }
            
            # Try to extract title and labels from first axes
            if fig.axes:
                ax = fig.axes[0]
                if ax.get_title():
                    metadata['title'] = ax.get_title()
                if ax.get_xlabel():
                    metadata['xlabel'] = ax.get_xlabel()
                if ax.get_ylabel():
                    metadata['ylabel'] = ax.get_ylabel()
                    
            return {
                'id': str(uuid.uuid4()),
                'format': 'png',
                'data': b64_data,
                'metadata': metadata,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error converting figure to data: {e}")
            return None
            
    def get_plots(self) -> List[Dict[str, Any]]:
        """Get all captured plots"""
        return self.plots.copy()
        
    def clear_plots(self):
        """Clear all captured plots"""
        self.plots.clear()
        
    def serialize_variables(self, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize variables for transport, handling special types"""
        serialized = {}
        
        for name, value in variables.items():
            try:
                serialized[name] = self._serialize_value(value, name)
            except Exception as e:
                # If serialization fails, store error info
                serialized[name] = {
                    'type': type(value).__name__,
                    'error': f'Serialization failed: {str(e)}',
                    'repr': str(value)[:200] + '...' if len(str(value)) > 200 else str(value)
                }
                
        return serialized
        
    def _serialize_value(self, value: Any, name: str) -> Dict[str, Any]:
        """Serialize a single value with type information"""
        value_type = type(value).__name__
        module = type(value).__module__
        
        # Handle basic Python types
        if value is None or isinstance(value, (bool, int, float, str)):
            return {
                'type': value_type,
                'value': value,
                'size': sys.getsizeof(value)
            }
            
        # Handle collections
        elif isinstance(value, (list, tuple)):
            if len(value) > 100:  # Limit large collections
                preview = value[:10]
                return {
                    'type': value_type,
                    'length': len(value),
                    'preview': [self._serialize_value(item, f'{name}[{i}]')['value'] 
                              for i, item in enumerate(preview)],
                    'truncated': True,
                    'size': sys.getsizeof(value)
                }
            else:
                return {
                    'type': value_type,
                    'value': [self._serialize_value(item, f'{name}[{i}]')['value'] 
                            for i, item in enumerate(value)],
                    'size': sys.getsizeof(value)
                }
                
        elif isinstance(value, dict):
            if len(value) > 50:  # Limit large dictionaries
                preview_keys = list(value.keys())[:10]
                preview = {k: self._serialize_value(value[k], f'{name}[{k}]')['value'] 
                          for k in preview_keys}
                return {
                    'type': value_type,
                    'length': len(value),
                    'preview': preview,
                    'keys': list(value.keys())[:20],
                    'truncated': True,
                    'size': sys.getsizeof(value)
                }
            else:
                return {
                    'type': value_type,
                    'value': {k: self._serialize_value(v, f'{name}[{k}]')['value'] 
                            for k, v in value.items()},
                    'size': sys.getsizeof(value)
                }
                
        # Handle NumPy arrays
        elif HAS_NUMPY and isinstance(value, np.ndarray):
            return self._serialize_numpy_array(value, name)
            
        # Handle Pandas objects
        elif HAS_PANDAS and isinstance(value, (pd.DataFrame, pd.Series)):
            return self._serialize_pandas_object(value, name)
            
        # Handle datetime objects
        elif isinstance(value, (datetime, date)):
            return {
                'type': value_type,
                'value': value.isoformat(),
                'size': sys.getsizeof(value)
            }
            
        # Handle other objects
        else:
            try:
                # Try JSON serialization
                json.dumps(value)
                return {
                    'type': value_type,
                    'module': module,
                    'value': value,
                    'size': sys.getsizeof(value)
                }
            except (TypeError, ValueError):
                # Use string representation
                str_repr = str(value)
                return {
                    'type': value_type,
                    'module': module,
                    'repr': str_repr[:500] + '...' if len(str_repr) > 500 else str_repr,
                    'size': sys.getsizeof(value),
                    'serializable': False
                }
                
    def _serialize_numpy_array(self, arr: 'np.ndarray', name: str) -> Dict[str, Any]:
        """Serialize NumPy array with metadata"""
        try:
            # For small arrays, include full data
            if arr.size <= 1000:
                return {
                    'type': 'numpy.ndarray',
                    'dtype': str(arr.dtype),
                    'shape': arr.shape,
                    'value': arr.tolist(),
                    'size': arr.nbytes,
                    'memory_usage': arr.nbytes
                }
            else:
                # For large arrays, include summary statistics
                return {
                    'type': 'numpy.ndarray',
                    'dtype': str(arr.dtype),
                    'shape': arr.shape,
                    'size': arr.size,
                    'memory_usage': arr.nbytes,
                    'statistics': {
                        'min': float(arr.min()) if arr.size > 0 else None,
                        'max': float(arr.max()) if arr.size > 0 else None,
                        'mean': float(arr.mean()) if arr.size > 0 else None,
                        'std': float(arr.std()) if arr.size > 0 else None,
                    },
                    'preview': arr.flat[:10].tolist() if arr.size > 0 else [],
                    'truncated': True
                }
        except Exception as e:
            return {
                'type': 'numpy.ndarray',
                'error': str(e),
                'repr': str(arr)[:200]
            }
            
    def _serialize_pandas_object(self, obj: Union['pd.DataFrame', 'pd.Series'], name: str) -> Dict[str, Any]:
        """Serialize Pandas DataFrame or Series"""
        try:
            if isinstance(obj, pd.DataFrame):
                return self._serialize_dataframe(obj, name)
            else:  # Series
                return self._serialize_series(obj, name)
        except Exception as e:
            return {
                'type': type(obj).__name__,
                'error': str(e),
                'repr': str(obj)[:500]
            }
            
    def _serialize_dataframe(self, df: 'pd.DataFrame', name: str) -> Dict[str, Any]:
        """Serialize Pandas DataFrame"""
        # For small DataFrames, include full data
        if len(df) <= 100 and len(df.columns) <= 20:
            return {
                'type': 'pandas.DataFrame',
                'shape': df.shape,
                'columns': df.columns.tolist(),
                'dtypes': df.dtypes.astype(str).to_dict(),
                'index': df.index.tolist() if len(df.index) <= 100 else None,
                'data': df.to_dict('records'),
                'memory_usage': df.memory_usage(deep=True).sum(),
                'size': df.size
            }
        else:
            # For large DataFrames, include summary
            return {
                'type': 'pandas.DataFrame',
                'shape': df.shape,
                'columns': df.columns.tolist(),
                'dtypes': df.dtypes.astype(str).to_dict(),
                'head': df.head().to_dict('records'),
                'tail': df.tail().to_dict('records') if len(df) > 5 else None,
                'describe': df.describe().to_dict() if len(df) > 0 else None,
                'memory_usage': df.memory_usage(deep=True).sum(),
                'size': df.size,
                'truncated': True
            }
            
    def _serialize_series(self, series: 'pd.Series', name: str) -> Dict[str, Any]:
        """Serialize Pandas Series"""
        if len(series) <= 100:
            return {
                'type': 'pandas.Series',
                'name': series.name,
                'dtype': str(series.dtype),
                'length': len(series),
                'index': series.index.tolist(),
                'data': series.tolist(),
                'memory_usage': series.memory_usage(deep=True)
            }
        else:
            return {
                'type': 'pandas.Series',
                'name': series.name,
                'dtype': str(series.dtype),
                'length': len(series),
                'head': series.head().tolist(),
                'tail': series.tail().tolist(),
                'describe': series.describe().to_dict() if series.dtype in ['int64', 'float64'] else None,
                'memory_usage': series.memory_usage(deep=True),
                'truncated': True
            }
            
    def capture_exception(self, exc_type, exc_value, exc_traceback) -> Dict[str, Any]:
        """Capture and serialize exception information"""
        return {
            'type': exc_type.__name__,
            'message': str(exc_value),
            'traceback': traceback.format_exception(exc_type, exc_value, exc_traceback),
            'timestamp': datetime.now().isoformat()
        }
        
    def format_output_for_display(self, variables: Dict[str, Any]) -> str:
        """Format variables for human-readable display"""
        lines = []
        
        for name, var_info in variables.items():
            if isinstance(var_info, dict) and 'type' in var_info:
                var_type = var_info['type']
                
                if var_type in ['int', 'float', 'str', 'bool']:
                    lines.append(f"{name}: {var_info['value']} ({var_type})")
                    
                elif var_type in ['list', 'tuple']:
                    length = var_info.get('length', len(var_info.get('value', [])))
                    lines.append(f"{name}: {var_type} with {length} elements")
                    
                elif var_type == 'dict':
                    length = var_info.get('length', len(var_info.get('value', {})))
                    lines.append(f"{name}: dict with {length} items")
                    
                elif var_type == 'numpy.ndarray':
                    shape = var_info.get('shape', 'unknown')
                    dtype = var_info.get('dtype', 'unknown')
                    lines.append(f"{name}: numpy.ndarray {shape} ({dtype})")
                    
                elif var_type == 'pandas.DataFrame':
                    shape = var_info.get('shape', 'unknown')
                    lines.append(f"{name}: pandas.DataFrame {shape}")
                    
                elif var_type == 'pandas.Series':
                    length = var_info.get('length', 'unknown')
                    lines.append(f"{name}: pandas.Series with {length} elements")
                    
                else:
                    lines.append(f"{name}: {var_type}")
            else:
                lines.append(f"{name}: {str(var_info)}")
                
        return '\n'.join(lines)
        
    def get_stats(self) -> Dict[str, Any]:
        """Get output handler statistics"""
        return {
            'plots_captured': len(self.plots),
            'max_plots': self.max_plots,
            'max_plot_size': self.max_plot_size,
            'max_variable_size': self.max_variable_size,
            'has_matplotlib': HAS_MATPLOTLIB,
            'has_numpy': HAS_NUMPY,
            'has_pandas': HAS_PANDAS
        }


# Global output handler instance
_output_handler = None

def get_output_handler() -> OutputHandler:
    """Get global output handler instance"""
    global _output_handler
    if _output_handler is None:
        _output_handler = OutputHandler()
    return _output_handler


if __name__ == '__main__':
    # Test the output handler
    handler = OutputHandler()
    
    # Test variable serialization
    test_vars = {
        'simple_int': 42,
        'simple_str': 'hello world',
        'simple_list': [1, 2, 3, 4, 5],
        'simple_dict': {'a': 1, 'b': 2, 'c': 3}
    }
    
    if HAS_NUMPY:
        test_vars['numpy_array'] = np.array([[1, 2, 3], [4, 5, 6]])
        
    if HAS_PANDAS:
        test_vars['dataframe'] = pd.DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})
        
    serialized = handler.serialize_variables(test_vars)
    
    print("Serialized variables:")
    print(json.dumps(serialized, indent=2, default=str))
    
    print("\nFormatted output:")
    print(handler.format_output_for_display(serialized))
    
    print("\nOutput handler stats:")
    print(json.dumps(handler.get_stats(), indent=2))