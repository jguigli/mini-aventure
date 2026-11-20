# Entry point to run the project. Each target calls one npm script.
.DEFAULT_GOAL := help
.PHONY: help install env dev test lint format build clean

help: ## Show available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-9s %s\n", $$1, $$2}'

install: ## Install all dependencies (npm workspaces)
	npm install

env: ## Create server/.env from the example (never overwrites an existing file)
	@if [ -f server/.env ]; then echo "server/.env already exists, left untouched."; \
	else cp server/.env.example server/.env && echo "server/.env created: paste your OPENAI_API_KEY in it."; fi

dev: ## Start the API server and the client (http://localhost:5173)
	npm run dev

test: ## Run unit tests (Vitest)
	npm test

lint: ## Lint the code (ESLint)
	npm run lint

format: ## Format the code (Prettier)
	npm run format

build: ## Type-check both apps and build the client
	npm run build

clean: ## Remove node_modules and build outputs
	rm -rf node_modules client/node_modules server/node_modules shared/node_modules client/dist
