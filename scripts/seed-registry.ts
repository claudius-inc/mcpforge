/**
 * MCPForge Registry Seed Script
 * 
 * Seeds the registry with curated OpenAPI specs for popular APIs.
 * Run after database init: npx tsx scripts/seed-registry.ts
 */

import { randomUUID } from 'crypto';
import { getDb } from '../src/lib/db';

interface SeedListing {
  title: string;
  description: string;
  readme: string;
  categories: string[];
  tags: string[];
  api_source_url: string;
  spec: object;
  language: 'typescript' | 'python';
  tool_names: string[];
  tool_count: number;
  featured: boolean;
}

const SYSTEM_USER_ID = 'system-mcpforge';

const SEED_LISTINGS: SeedListing[] = [
  // 1. OpenWeatherMap
  {
    title: 'OpenWeatherMap',
    description: 'Get current weather, forecasts, and historical data for any location worldwide.',
    readme: `# OpenWeatherMap MCP Server\n\nAccess weather data from OpenWeatherMap API.\n\n## Tools\n- **get_current_weather** — Current conditions by city or coordinates\n- **get_5day_forecast** — 5-day / 3-hour forecast\n- **get_air_pollution** — Air quality index and pollutant data\n\n## Setup\nGet a free API key at [openweathermap.org](https://openweathermap.org/api)\n\nSet \`OPENWEATHERMAP_API_KEY\` in your environment.`,
    categories: ['weather'],
    tags: ['weather', 'forecast', 'temperature', 'climate', 'geolocation'],
    api_source_url: 'https://openweathermap.org/api',
    spec: {
      openapi: '3.0.3',
      info: { title: 'OpenWeatherMap API', version: '2.5', description: 'Current weather, forecasts, and air pollution data.' },
      servers: [{ url: 'https://api.openweathermap.org' }],
      paths: {
        '/data/2.5/weather': {
          get: {
            operationId: 'getCurrentWeather',
            summary: 'Get current weather by city name or coordinates',
            parameters: [
              { name: 'q', in: 'query', schema: { type: 'string' }, description: 'City name (e.g., "London" or "London,GB")' },
              { name: 'lat', in: 'query', schema: { type: 'number' }, description: 'Latitude' },
              { name: 'lon', in: 'query', schema: { type: 'number' }, description: 'Longitude' },
              { name: 'units', in: 'query', schema: { type: 'string', enum: ['metric', 'imperial', 'standard'] }, description: 'Temperature units' },
              { name: 'appid', in: 'query', required: true, schema: { type: 'string' }, description: 'API key' },
            ],
            responses: { '200': { description: 'Weather data' } },
          },
        },
        '/data/2.5/forecast': {
          get: {
            operationId: 'get5DayForecast',
            summary: 'Get 5-day / 3-hour forecast',
            parameters: [
              { name: 'q', in: 'query', schema: { type: 'string' }, description: 'City name' },
              { name: 'lat', in: 'query', schema: { type: 'number' }, description: 'Latitude' },
              { name: 'lon', in: 'query', schema: { type: 'number' }, description: 'Longitude' },
              { name: 'units', in: 'query', schema: { type: 'string', enum: ['metric', 'imperial', 'standard'] } },
              { name: 'cnt', in: 'query', schema: { type: 'integer' }, description: 'Number of timestamps (max 40)' },
              { name: 'appid', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Forecast data' } },
          },
        },
        '/data/2.5/air_pollution': {
          get: {
            operationId: 'getAirPollution',
            summary: 'Get air pollution data for coordinates',
            parameters: [
              { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
              { name: 'lon', in: 'query', required: true, schema: { type: 'number' } },
              { name: 'appid', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Air quality data' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['get_current_weather', 'get_5day_forecast', 'get_air_pollution'],
    tool_count: 3,
    featured: true,
  },

  // 2. GitHub REST API
  {
    title: 'GitHub',
    description: 'Manage repositories, issues, pull requests, and users on GitHub.',
    readme: `# GitHub MCP Server\n\nInteract with GitHub\'s REST API.\n\n## Tools\n- **list_repos** — List repositories for a user\n- **get_repo** — Get repository details\n- **list_issues** — List issues in a repository\n- **create_issue** — Create a new issue\n- **search_repos** — Search repositories by query\n- **get_user** — Get user profile\n\n## Setup\nCreate a Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens)\n\nSet \`GITHUB_TOKEN\` in your environment.`,
    categories: ['devtools'],
    tags: ['github', 'git', 'repositories', 'issues', 'pull-requests', 'developer'],
    api_source_url: 'https://docs.github.com/en/rest',
    spec: {
      openapi: '3.0.3',
      info: { title: 'GitHub REST API', version: '2022-11-28', description: 'GitHub REST API - key endpoints for repos, issues, and users.' },
      servers: [{ url: 'https://api.github.com' }],
      security: [{ bearer: [] }],
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
      paths: {
        '/users/{username}/repos': {
          get: {
            operationId: 'listUserRepos',
            summary: 'List repositories for a user',
            parameters: [
              { name: 'username', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'sort', in: 'query', schema: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'] } },
              { name: 'per_page', in: 'query', schema: { type: 'integer', default: 30 } },
            ],
            responses: { '200': { description: 'List of repositories' } },
          },
        },
        '/repos/{owner}/{repo}': {
          get: {
            operationId: 'getRepo',
            summary: 'Get a repository',
            parameters: [
              { name: 'owner', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'repo', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Repository details' } },
          },
        },
        '/repos/{owner}/{repo}/issues': {
          get: {
            operationId: 'listIssues',
            summary: 'List repository issues',
            parameters: [
              { name: 'owner', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'repo', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'state', in: 'query', schema: { type: 'string', enum: ['open', 'closed', 'all'] } },
              { name: 'per_page', in: 'query', schema: { type: 'integer', default: 30 } },
            ],
            responses: { '200': { description: 'List of issues' } },
          },
          post: {
            operationId: 'createIssue',
            summary: 'Create an issue',
            parameters: [
              { name: 'owner', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'repo', in: 'path', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
              required: true,
              content: { 'application/json': { schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  body: { type: 'string' },
                  labels: { type: 'array', items: { type: 'string' } },
                },
              } } },
            },
            responses: { '201': { description: 'Issue created' } },
          },
        },
        '/search/repositories': {
          get: {
            operationId: 'searchRepos',
            summary: 'Search repositories',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
              { name: 'sort', in: 'query', schema: { type: 'string', enum: ['stars', 'forks', 'updated'] } },
              { name: 'per_page', in: 'query', schema: { type: 'integer', default: 30 } },
            ],
            responses: { '200': { description: 'Search results' } },
          },
        },
        '/users/{username}': {
          get: {
            operationId: 'getUser',
            summary: 'Get a user profile',
            parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'User profile' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['list_user_repos', 'get_repo', 'list_issues', 'create_issue', 'search_repos', 'get_user'],
    tool_count: 6,
    featured: true,
  },

  // 3. Stripe
  {
    title: 'Stripe Payments',
    description: 'Create charges, manage customers, list payments, and handle subscriptions with Stripe.',
    readme: `# Stripe MCP Server\n\nCore Stripe payment operations.\n\n## Tools\n- **list_customers** — List all customers\n- **create_customer** — Create a new customer\n- **list_charges** — List charges with filters\n- **create_charge** — Create a one-time charge\n- **list_subscriptions** — List subscriptions\n- **get_balance** — Get account balance\n\n## Setup\nGet your API key from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)\n\nSet \`STRIPE_API_KEY\` in your environment.`,
    categories: ['finance'],
    tags: ['payments', 'stripe', 'billing', 'subscriptions', 'ecommerce'],
    api_source_url: 'https://stripe.com/docs/api',
    spec: {
      openapi: '3.0.3',
      info: { title: 'Stripe API', version: '2023-10-16', description: 'Core Stripe payment endpoints.' },
      servers: [{ url: 'https://api.stripe.com' }],
      security: [{ bearer: [] }],
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
      paths: {
        '/v1/customers': {
          get: {
            operationId: 'listCustomers',
            summary: 'List all customers',
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
              { name: 'email', in: 'query', schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'List of customers' } },
          },
          post: {
            operationId: 'createCustomer',
            summary: 'Create a customer',
            requestBody: {
              content: { 'application/x-www-form-urlencoded': { schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              } } },
            },
            responses: { '200': { description: 'Customer created' } },
          },
        },
        '/v1/charges': {
          get: {
            operationId: 'listCharges',
            summary: 'List charges',
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
              { name: 'customer', in: 'query', schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'List of charges' } },
          },
          post: {
            operationId: 'createCharge',
            summary: 'Create a charge',
            requestBody: {
              content: { 'application/x-www-form-urlencoded': { schema: {
                type: 'object',
                required: ['amount', 'currency'],
                properties: {
                  amount: { type: 'integer', description: 'Amount in cents' },
                  currency: { type: 'string', description: 'Three-letter ISO currency code' },
                  customer: { type: 'string' },
                  description: { type: 'string' },
                },
              } } },
            },
            responses: { '200': { description: 'Charge created' } },
          },
        },
        '/v1/subscriptions': {
          get: {
            operationId: 'listSubscriptions',
            summary: 'List subscriptions',
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
              { name: 'customer', in: 'query', schema: { type: 'string' } },
              { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'past_due', 'canceled', 'all'] } },
            ],
            responses: { '200': { description: 'List of subscriptions' } },
          },
        },
        '/v1/balance': {
          get: {
            operationId: 'getBalance',
            summary: 'Get account balance',
            responses: { '200': { description: 'Account balance' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['list_customers', 'create_customer', 'list_charges', 'create_charge', 'list_subscriptions', 'get_balance'],
    tool_count: 6,
    featured: true,
  },

  // 4. Hacker News
  {
    title: 'Hacker News',
    description: 'Read top stories, new stories, comments, and user profiles from Hacker News.',
    readme: `# Hacker News MCP Server\n\nAccess the Hacker News Firebase API.\n\n## Tools\n- **get_top_stories** — IDs of current top stories\n- **get_new_stories** — IDs of newest stories\n- **get_item** — Get any item (story, comment, job, poll)\n- **get_user** — Get user profile and karma\n\n## Setup\nNo API key needed — the HN API is public.`,
    categories: ['social'],
    tags: ['hacker-news', 'hn', 'news', 'tech', 'stories', 'comments'],
    api_source_url: 'https://github.com/HackerNews/API',
    spec: {
      openapi: '3.0.3',
      info: { title: 'Hacker News API', version: '0', description: 'Hacker News public Firebase API.' },
      servers: [{ url: 'https://hacker-news.firebaseio.com' }],
      paths: {
        '/v0/topstories.json': {
          get: {
            operationId: 'getTopStories',
            summary: 'Get IDs of top 500 stories',
            responses: { '200': { description: 'Array of story IDs' } },
          },
        },
        '/v0/newstories.json': {
          get: {
            operationId: 'getNewStories',
            summary: 'Get IDs of newest 500 stories',
            responses: { '200': { description: 'Array of story IDs' } },
          },
        },
        '/v0/item/{id}.json': {
          get: {
            operationId: 'getItem',
            summary: 'Get a story, comment, job, or poll by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'Item data' } },
          },
        },
        '/v0/user/{id}.json': {
          get: {
            operationId: 'getUser',
            summary: 'Get user profile',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Username' }],
            responses: { '200': { description: 'User profile with karma' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['get_top_stories', 'get_new_stories', 'get_item', 'get_user'],
    tool_count: 4,
    featured: false,
  },

  // 5. JSONPlaceholder
  {
    title: 'JSONPlaceholder',
    description: 'Free fake REST API for testing and prototyping. Posts, comments, users, todos, albums, photos.',
    readme: `# JSONPlaceholder MCP Server\n\nFake REST API for testing — no auth needed.\n\n## Tools\n- **list_posts** / **get_post** / **create_post**\n- **list_post_comments** — Comments on a post\n- **list_todos** — User todos\n- **list_users** / **get_user**\n\nPerfect for testing MCP client integrations.`,
    categories: ['devtools'],
    tags: ['testing', 'mock', 'rest', 'api', 'placeholder', 'fake-data'],
    api_source_url: 'https://jsonplaceholder.typicode.com/',
    spec: {
      openapi: '3.0.3',
      info: { title: 'JSONPlaceholder', version: '1.0', description: 'Free fake API for testing and prototyping.' },
      servers: [{ url: 'https://jsonplaceholder.typicode.com' }],
      paths: {
        '/posts': {
          get: {
            operationId: 'listPosts',
            summary: 'List all posts',
            parameters: [{ name: 'userId', in: 'query', schema: { type: 'integer' }, description: 'Filter by user' }],
            responses: { '200': { description: 'Array of posts' } },
          },
          post: {
            operationId: 'createPost',
            summary: 'Create a post',
            requestBody: { content: { 'application/json': { schema: {
              type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, userId: { type: 'integer' } },
            } } } },
            responses: { '201': { description: 'Post created' } },
          },
        },
        '/posts/{id}': {
          get: {
            operationId: 'getPost',
            summary: 'Get a post by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'Post data' } },
          },
        },
        '/posts/{id}/comments': {
          get: {
            operationId: 'listPostComments',
            summary: 'List comments on a post',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'Array of comments' } },
          },
        },
        '/todos': {
          get: {
            operationId: 'listTodos',
            summary: 'List all todos',
            parameters: [{ name: 'userId', in: 'query', schema: { type: 'integer' } }],
            responses: { '200': { description: 'Array of todos' } },
          },
        },
        '/users': {
          get: { operationId: 'listUsers', summary: 'List all users', responses: { '200': { description: 'Array of users' } } },
        },
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            summary: 'Get user by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { description: 'User data' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['list_posts', 'create_post', 'get_post', 'list_post_comments', 'list_todos', 'list_users', 'get_user'],
    tool_count: 7,
    featured: false,
  },

  // 6. NASA APOD
  {
    title: 'NASA APIs',
    description: 'Astronomy Picture of the Day, Mars Rover photos, and Near-Earth Object data from NASA.',
    readme: `# NASA MCP Server\n\nAccess NASA open APIs.\n\n## Tools\n- **get_apod** — Astronomy Picture of the Day\n- **get_mars_rover_photos** — Mars rover imagery\n- **get_neo_feed** — Near-Earth Objects (asteroids)\n\n## Setup\nGet a free API key at [api.nasa.gov](https://api.nasa.gov/)\n\nSet \`NASA_API_KEY\` (or use \`DEMO_KEY\` for testing).`,
    categories: ['data'],
    tags: ['nasa', 'space', 'astronomy', 'mars', 'asteroids', 'science'],
    api_source_url: 'https://api.nasa.gov/',
    spec: {
      openapi: '3.0.3',
      info: { title: 'NASA Open APIs', version: '1.0', description: 'APOD, Mars Rovers, and Near-Earth Objects.' },
      servers: [{ url: 'https://api.nasa.gov' }],
      paths: {
        '/planetary/apod': {
          get: {
            operationId: 'getApod',
            summary: 'Get Astronomy Picture of the Day',
            parameters: [
              { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Date (YYYY-MM-DD), default today' },
              { name: 'count', in: 'query', schema: { type: 'integer' }, description: 'Return N random images' },
              { name: 'api_key', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'APOD data with image URL, title, explanation' } },
          },
        },
        '/mars-photos/api/v1/rovers/{rover}/photos': {
          get: {
            operationId: 'getMarsRoverPhotos',
            summary: 'Get Mars Rover photos',
            parameters: [
              { name: 'rover', in: 'path', required: true, schema: { type: 'string', enum: ['curiosity', 'opportunity', 'spirit', 'perseverance'] } },
              { name: 'sol', in: 'query', schema: { type: 'integer' }, description: 'Martian sol (day)' },
              { name: 'earth_date', in: 'query', schema: { type: 'string', format: 'date' } },
              { name: 'camera', in: 'query', schema: { type: 'string' }, description: 'Camera name (e.g., FHAZ, RHAZ, MAST, NAVCAM)' },
              { name: 'api_key', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Array of photos' } },
          },
        },
        '/neo/rest/v1/feed': {
          get: {
            operationId: 'getNeoFeed',
            summary: 'Get near-Earth objects for a date range',
            parameters: [
              { name: 'start_date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
              { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Max 7 days after start' },
              { name: 'api_key', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Near-Earth objects by date' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['get_apod', 'get_mars_rover_photos', 'get_neo_feed'],
    tool_count: 3,
    featured: true,
  },

  // 7. Exchange Rates
  {
    title: 'Exchange Rates',
    description: 'Live and historical foreign exchange rates. 170+ currencies, free tier available.',
    readme: `# Exchange Rates MCP Server\n\nCurrency exchange rates from exchangerate-api.com.\n\n## Tools\n- **get_latest_rates** — Latest rates for a base currency\n- **convert** — Convert amount between currencies\n- **get_supported_currencies** — List all supported currencies\n\n## Setup\nGet a free API key at [exchangerate-api.com](https://www.exchangerate-api.com/)\n\nSet \`EXCHANGERATE_API_KEY\`.`,
    categories: ['finance'],
    tags: ['currency', 'exchange-rates', 'forex', 'conversion', 'finance'],
    api_source_url: 'https://www.exchangerate-api.com/docs/overview',
    spec: {
      openapi: '3.0.3',
      info: { title: 'ExchangeRate API', version: '6', description: 'Free currency exchange rate API.' },
      servers: [{ url: 'https://v6.exchangerate-api.com/v6/{api_key}', variables: { api_key: { default: 'YOUR_API_KEY' } } }],
      paths: {
        '/latest/{base}': {
          get: {
            operationId: 'getLatestRates',
            summary: 'Get latest exchange rates for a base currency',
            parameters: [{ name: 'base', in: 'path', required: true, schema: { type: 'string' }, description: 'Base currency code (e.g., USD)' }],
            responses: { '200': { description: 'Exchange rates' } },
          },
        },
        '/pair/{base}/{target}/{amount}': {
          get: {
            operationId: 'convertCurrency',
            summary: 'Convert amount between two currencies',
            parameters: [
              { name: 'base', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'target', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'amount', in: 'path', required: true, schema: { type: 'number' } },
            ],
            responses: { '200': { description: 'Conversion result' } },
          },
        },
        '/codes': {
          get: {
            operationId: 'getSupportedCurrencies',
            summary: 'List all supported currency codes',
            responses: { '200': { description: 'Supported currencies' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['get_latest_rates', 'convert_currency', 'get_supported_currencies'],
    tool_count: 3,
    featured: false,
  },

  // 8. NewsAPI
  {
    title: 'NewsAPI',
    description: 'Search worldwide news articles, top headlines, and news sources from 150,000+ outlets.',
    readme: `# NewsAPI MCP Server\n\nSearch global news articles and headlines.\n\n## Tools\n- **get_top_headlines** — Top headlines by country, category, or source\n- **search_everything** — Full-text search across 150k+ news sources\n- **get_sources** — List available news sources\n\n## Setup\nGet a free API key at [newsapi.org](https://newsapi.org/register)\n\nSet \`NEWSAPI_KEY\`.`,
    categories: ['media'],
    tags: ['news', 'headlines', 'articles', 'journalism', 'media', 'search'],
    api_source_url: 'https://newsapi.org/docs',
    spec: {
      openapi: '3.0.3',
      info: { title: 'NewsAPI', version: '2', description: 'Search news articles from 150,000+ sources worldwide.' },
      servers: [{ url: 'https://newsapi.org' }],
      paths: {
        '/v2/top-headlines': {
          get: {
            operationId: 'getTopHeadlines',
            summary: 'Get top headlines',
            parameters: [
              { name: 'country', in: 'query', schema: { type: 'string' }, description: '2-letter country code (e.g., us, gb)' },
              { name: 'category', in: 'query', schema: { type: 'string', enum: ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'] } },
              { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Keywords to search for' },
              { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
              { name: 'apiKey', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Headlines' } },
          },
        },
        '/v2/everything': {
          get: {
            operationId: 'searchEverything',
            summary: 'Search all articles',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
              { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
              { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
              { name: 'language', in: 'query', schema: { type: 'string' } },
              { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['relevancy', 'popularity', 'publishedAt'] } },
              { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
              { name: 'apiKey', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Articles' } },
          },
        },
        '/v2/top-headlines/sources': {
          get: {
            operationId: 'getSources',
            summary: 'Get available news sources',
            parameters: [
              { name: 'language', in: 'query', schema: { type: 'string' } },
              { name: 'country', in: 'query', schema: { type: 'string' } },
              { name: 'category', in: 'query', schema: { type: 'string' } },
              { name: 'apiKey', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'News sources' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['get_top_headlines', 'search_everything', 'get_sources'],
    tool_count: 3,
    featured: false,
  },

  // 9. Spotify Web API
  {
    title: 'Spotify',
    description: 'Search tracks, albums, artists, playlists. Get recommendations and audio features.',
    readme: `# Spotify MCP Server\n\nAccess the Spotify Web API.\n\n## Tools\n- **search** — Search for tracks, albums, artists, playlists\n- **get_track** — Get track details + audio features\n- **get_artist** — Get artist info\n- **get_artist_top_tracks** — Artist\'s top tracks by country\n- **get_recommendations** — Get song recommendations from seed tracks/artists/genres\n\n## Setup\nCreate an app at [developer.spotify.com](https://developer.spotify.com/dashboard)\n\nSet \`SPOTIFY_CLIENT_ID\` and \`SPOTIFY_CLIENT_SECRET\`.`,
    categories: ['media'],
    tags: ['spotify', 'music', 'audio', 'tracks', 'playlists', 'recommendations'],
    api_source_url: 'https://developer.spotify.com/documentation/web-api',
    spec: {
      openapi: '3.0.3',
      info: { title: 'Spotify Web API', version: '1', description: 'Search, browse, and get recommendations from Spotify.' },
      servers: [{ url: 'https://api.spotify.com' }],
      security: [{ bearer: [] }],
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
      paths: {
        '/v1/search': {
          get: {
            operationId: 'search',
            summary: 'Search for tracks, albums, artists, or playlists',
            parameters: [
              { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'type', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated: track,album,artist,playlist' },
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
              { name: 'market', in: 'query', schema: { type: 'string' }, description: '2-letter country code' },
            ],
            responses: { '200': { description: 'Search results' } },
          },
        },
        '/v1/tracks/{id}': {
          get: {
            operationId: 'getTrack',
            summary: 'Get track by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Track details' } },
          },
        },
        '/v1/artists/{id}': {
          get: {
            operationId: 'getArtist',
            summary: 'Get artist by ID',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'Artist details' } },
          },
        },
        '/v1/artists/{id}/top-tracks': {
          get: {
            operationId: 'getArtistTopTracks',
            summary: 'Get artist top tracks',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'market', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Top tracks' } },
          },
        },
        '/v1/recommendations': {
          get: {
            operationId: 'getRecommendations',
            summary: 'Get track recommendations',
            parameters: [
              { name: 'seed_tracks', in: 'query', schema: { type: 'string' }, description: 'Comma-separated track IDs (up to 5 total seeds)' },
              { name: 'seed_artists', in: 'query', schema: { type: 'string' } },
              { name: 'seed_genres', in: 'query', schema: { type: 'string' } },
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: { '200': { description: 'Recommended tracks' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['search', 'get_track', 'get_artist', 'get_artist_top_tracks', 'get_recommendations'],
    tool_count: 5,
    featured: true,
  },

  // 10. SendGrid Email
  {
    title: 'SendGrid Email',
    description: 'Send transactional and marketing emails, manage contacts and lists via SendGrid.',
    readme: `# SendGrid MCP Server\n\nSend emails and manage contacts with SendGrid.\n\n## Tools\n- **send_email** — Send a transactional email\n- **list_contacts** — List marketing contacts\n- **add_contacts** — Add contacts to marketing lists\n- **get_stats** — Email delivery statistics\n\n## Setup\nGet an API key at [app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys)\n\nSet \`SENDGRID_API_KEY\`.`,
    categories: ['communication'],
    tags: ['email', 'sendgrid', 'transactional', 'marketing', 'smtp'],
    api_source_url: 'https://docs.sendgrid.com/api-reference',
    spec: {
      openapi: '3.0.3',
      info: { title: 'SendGrid API', version: '3', description: 'Email delivery and contact management.' },
      servers: [{ url: 'https://api.sendgrid.com' }],
      security: [{ bearer: [] }],
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
      paths: {
        '/v3/mail/send': {
          post: {
            operationId: 'sendEmail',
            summary: 'Send an email',
            requestBody: {
              required: true,
              content: { 'application/json': { schema: {
                type: 'object',
                required: ['personalizations', 'from', 'subject', 'content'],
                properties: {
                  personalizations: { type: 'array', items: { type: 'object', properties: { to: { type: 'array', items: { type: 'object', properties: { email: { type: 'string' }, name: { type: 'string' } } } } } } },
                  from: { type: 'object', properties: { email: { type: 'string' }, name: { type: 'string' } } },
                  subject: { type: 'string' },
                  content: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, value: { type: 'string' } } } },
                },
              } } },
            },
            responses: { '202': { description: 'Email accepted for delivery' } },
          },
        },
        '/v3/marketing/contacts': {
          get: {
            operationId: 'listContacts',
            summary: 'List marketing contacts',
            responses: { '200': { description: 'Contact list' } },
          },
          put: {
            operationId: 'addContacts',
            summary: 'Add or update contacts',
            requestBody: {
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  contacts: { type: 'array', items: { type: 'object', properties: {
                    email: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' },
                  } } },
                },
              } } },
            },
            responses: { '202': { description: 'Contacts accepted' } },
          },
        },
        '/v3/stats': {
          get: {
            operationId: 'getEmailStats',
            summary: 'Get email delivery statistics',
            parameters: [
              { name: 'start_date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
              { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } },
            ],
            responses: { '200': { description: 'Email statistics' } },
          },
        },
      },
    },
    language: 'typescript',
    tool_names: ['send_email', 'list_contacts', 'add_contacts', 'get_email_stats'],
    tool_count: 4,
    featured: false,
  },
];

async function seed() {
  console.log('🌱 Seeding MCPForge registry with', SEED_LISTINGS.length, 'listings...\n');

  const db = getDb();

  // Ensure system user exists
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, github_id, username, email, name, avatar_url, tier)
          VALUES (?, 0, 'mcpforge', 'team@mcpforge.dev', 'MCPForge', '', 'team')`,
    args: [SYSTEM_USER_ID],
  });

  for (const listing of SEED_LISTINGS) {
    const id = randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT OR REPLACE INTO registry_listings
            (id, server_id, user_id, title, description, readme, categories, tags,
             api_source_url, spec_snapshot, language, tool_count, tool_names,
             stars_count, forks_count, installs_count, featured, verified, status,
             version, published_at, updated_at)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 1, 'published', '1.0.0', ?, ?)`,
      args: [
        id,
        SYSTEM_USER_ID,
        listing.title,
        listing.description,
        listing.readme,
        JSON.stringify(listing.categories),
        JSON.stringify(listing.tags),
        listing.api_source_url,
        JSON.stringify(listing.spec),
        listing.language,
        listing.tool_count,
        JSON.stringify(listing.tool_names),
        listing.featured ? 1 : 0,
        now,
        now,
      ],
    });

    console.log(`  ✅ ${listing.title} (${listing.tool_count} tools, ${listing.categories.join('/')})${listing.featured ? ' ⭐ featured' : ''}`);
  }

  console.log('\n🎉 Registry seeded with', SEED_LISTINGS.length, 'listings.');
  console.log('   Featured:', SEED_LISTINGS.filter(l => l.featured).length);
  console.log('   Categories:', [...new Set(SEED_LISTINGS.flatMap(l => l.categories))].join(', '));
  console.log('   Total tools:', SEED_LISTINGS.reduce((sum, l) => sum + l.tool_count, 0));
}

seed().catch(console.error);
