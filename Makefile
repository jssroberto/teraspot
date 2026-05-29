# ==============================================================================
# TeraSpot Monorepo Tasks & Test Orchestrator
# ==============================================================================
#
# DESIGN DECISION: Process-Isolated Test Runner
# ---------------------------------------------
# We run Lambda test suites in separate, isolated processes (via sequential target
# recipes) rather than a single unified "pytest" execution.
#
# Why: Python caches imported modules globally in sys.modules. Because all Lambdas
# are packaged as flat files using AWS Lambda's default entry-point name
# (lambda_function.py), running a single-process global test suite causes severe
# import cache collisions.
#
# FUTURE WORK / RECOMMENDED REFAC:
# To enable a single-process global test suite (and enable fast parallel runs via
# pytest-xdist), we should rename each entry-point uniquely in a future PR
# (e.g. backend/lambdas/config_saver/config_saver_handler.py) and update our
# AWS SAM / deployment pipeline configs accordingly.
#
# ==============================================================================

.PHONY: test test-lambdas test-fog help

help:
	@echo "TeraSpot Monorepo Tasks:"
	@echo "  make test          Run all monorepo test suites in process isolation"
	@echo "  make test-lambdas  Run backend Lambda test suites"
	@echo "  make test-fog      Run simulated edge camera tests"


test: test-lambdas test-fog
	@echo "🏆 All test suites executed successfully!"

test-lambdas:
	@echo "🏃 Running Lambda test suites..."
	uv run pytest --import-mode=importlib backend/lambdas

test-fog:
	@echo "🏃 Running simulated edge node tests..."
	uv run pytest fog/
