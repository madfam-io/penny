.PHONY: help install dev build test lint clean docker-up docker-down

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	npm install

dev: ## Start development servers
	npm run dev

build: ## Build all packages and apps
	npm run build

test: ## Run all tests
	npm run test

test-e2e: ## Run end-to-end tests
	npm run test:e2e

lint: ## Run linting
	npm run lint

typecheck: ## Run type checking
	npm run typecheck

format: ## Format code
	npm run format

clean: ## Clean build artifacts
	npm run clean

docker-up: ## Start Docker services
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@docker-compose ps

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## Show Docker logs
	docker-compose logs -f

setup-local: docker-up ## Setup local development environment
	@echo "Creating MinIO bucket..."
	@docker exec penny-minio mc alias set local http://localhost:9000 minioadmin minioadmin
	@docker exec penny-minio mc mb local/penny-artifacts --ignore-existing
	@echo "Local environment is ready!"

reset-db: ## Reset database
	docker-compose exec postgres psql -U penny -c "DROP DATABASE IF EXISTS penny;"
	docker-compose exec postgres psql -U penny -c "CREATE DATABASE penny;"
	@echo "Database reset complete"