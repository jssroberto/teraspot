---
name: python-imports-and-mocking
description: Standards for pythonpath resolution and AWS client exception mocking.
---

# Python Imports & Mocking

## 1. Path Resolution
* **Rule**: Do not modify `sys.path` in source or test files.
* **Standard**: Declare path roots in `pytest.ini`, `pyproject.toml`, or inject via `PYTHONPATH`.

## 2. Boto3 Exceptions
* **Rule**: Catch `botocore.exceptions.ClientError` instead of dynamic properties (e.g., `s3.exceptions.NoSuchKey`).
* **Standard**:
  ```python
  from botocore.exceptions import ClientError
  try:
      client.action(...)
  except ClientError as e:
      if e.response['Error']['Code'] == 'NoSuchKey':
          # Handle error
  ```
  This prevents `TypeError` crashes when exceptions resolve to mocks during test executions.
