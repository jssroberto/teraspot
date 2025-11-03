# backend/lambdas/config_saver/tests/conftest.py
import pytest
import os

@pytest.fixture(scope='function', autouse=True)
def setup_aws_mock():
    """Setup fake AWS credentials para todos los tests"""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
    yield
