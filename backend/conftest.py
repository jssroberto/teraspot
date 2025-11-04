import sys
import os

# Agregar cada lambda al path
lambdas_dir = os.path.join(os.path.dirname(__file__), 'lambdas')
for lambda_dir in os.listdir(lambdas_dir):
    lambda_path = os.path.join(lambdas_dir, lambda_dir)
    if os.path.isdir(lambda_path) and lambda_dir != '__pycache__':
        if lambda_path not in sys.path:
            sys.path.insert(0, lambda_path)

# Agregar shared al path
shared_path = os.path.join(os.path.dirname(__file__), 'lambdas', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)
