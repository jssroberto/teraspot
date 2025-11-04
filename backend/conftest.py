import sys
import os

# Obtener directorio backend
backend_dir = os.path.dirname(__file__)

# Agregar cada lambda al path (para que pytest las encuentre)
lambdas_dir = os.path.join(backend_dir, 'lambdas')
for lambda_dir in os.listdir(lambdas_dir):
    lambda_path = os.path.join(lambdas_dir, lambda_dir)
    if os.path.isdir(lambda_path) and lambda_dir not in ['__pycache__', 'shared']:
        # Agregar carpeta principal del lambda
        if lambda_path not in sys.path:
            sys.path.insert(0, lambda_path)
        # Agregar carpeta tests
        tests_path = os.path.join(lambda_path, 'tests')
        if os.path.isdir(tests_path) and tests_path not in sys.path:
            sys.path.insert(0, tests_path)

# Agregar shared
shared_path = os.path.join(lambdas_dir, 'shared')
if os.path.isdir(shared_path) and shared_path not in sys.path:
    sys.path.insert(0, shared_path)
