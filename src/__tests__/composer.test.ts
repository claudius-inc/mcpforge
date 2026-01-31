import { describe, it, expect } from 'vitest';
import { composeAPIs } from '../lib/composer';
import type { APISource } from '../lib/composer';

// Minimal valid OpenAPI specs for testing
const weatherSpec = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Weather API', version: '1.0.0', description: 'Get weather data' },
  servers: [{ url: 'https://api.weather.com' }],
  paths: {
    '/current': {
      get: {
        operationId: 'getCurrentWeather',
        summary: 'Get current weather',
        parameters: [
          { name: 'city', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Weather data' } },
      },
    },
    '/forecast': {
      get: {
        operationId: 'getForecast',
        summary: 'Get weather forecast',
        parameters: [
          { name: 'city', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'days', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Forecast data' } },
      },
    },
  },
});

const calendarSpec = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Calendar API', version: '2.0.0', description: 'Manage calendar events' },
  servers: [{ url: 'https://api.calendar.io' }],
  paths: {
    '/events': {
      get: {
        operationId: 'listEvents',
        summary: 'List calendar events',
        responses: { '200': { description: 'Event list' } },
      },
      post: {
        operationId: 'createEvent',
        summary: 'Create a new event',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string', format: 'date' },
                },
                required: ['title', 'date'],
              },
            },
          },
        },
        responses: { '201': { description: 'Event created' } },
      },
    },
    '/events/{id}': {
      delete: {
        operationId: 'deleteEvent',
        summary: 'Delete an event',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Deleted' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
  },
  security: [{ bearerAuth: [] }],
});

const githubSpec = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'GitHub API', version: '1.0.0' },
  servers: [{ url: 'https://api.github.com' }],
  paths: {
    '/repos/{owner}/{repo}': {
      get: {
        operationId: 'getRepo',
        summary: 'Get a repository',
        parameters: [
          { name: 'owner', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'repo', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Repository data' } },
      },
    },
  },
  components: {
    securitySchemes: {
      token: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ token: [] }],
});

describe('composeAPIs', () => {
  describe('basic composition', () => {
    it('should compose two APIs into a single config', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config, errors, warnings } = composeAPIs(apis);

      expect(errors).toHaveLength(0);
      expect(config.tools.length).toBe(5); // 2 weather + 3 calendar
      expect(config.name).toContain('weather');
      expect(config.name).toContain('calendar');
    });

    it('should prefix tool names with API name', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config } = composeAPIs(apis);
      const toolNames = config.tools.map(t => t.name);

      expect(toolNames).toContain('weather_getcurrentweather');
      expect(toolNames).toContain('weather_getforecast');
      expect(toolNames).toContain('calendar_listevents');
      expect(toolNames).toContain('calendar_createevent');
      expect(toolNames).toContain('calendar_deleteevent');
    });

    it('should tag descriptions with API name', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
      ];

      const { config } = composeAPIs(apis);
      for (const tool of config.tools) {
        expect(tool.description).toMatch(/^\[weather\]/);
      }
    });

    it('should prefix env vars per API', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config } = composeAPIs(apis);
      const envVarNames = config.envVars.map(v => v.name);

      expect(envVarNames).toContain('WEATHER_API_BASE_URL');
      expect(envVarNames).toContain('CALENDAR_API_BASE_URL');
      expect(envVarNames).toContain('CALENDAR_API_BEARER_TOKEN');
    });

    it('should set baseUrlEnvVar on tool handlers', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config } = composeAPIs(apis);

      const weatherTool = config.tools.find(t => t.name.startsWith('weather_'));
      expect(weatherTool?.handler.baseUrlEnvVar).toBe('WEATHER_API_BASE_URL');

      const calendarTool = config.tools.find(t => t.name.startsWith('calendar_'));
      expect(calendarTool?.handler.baseUrlEnvVar).toBe('CALENDAR_API_BASE_URL');
    });
  });

  describe('custom options', () => {
    it('should use custom server name', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
      ];

      const { config } = composeAPIs(apis, 'My Super Server');
      expect(config.name).toBe('my-super-server');
    });

    it('should use custom server description', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
      ];

      const { config } = composeAPIs(apis, undefined, 'A combined weather & calendar server');
      expect(config.description).toBe('A combined weather & calendar server');
    });

    it('should use custom prefix for API', () => {
      const apis: APISource[] = [
        { name: 'Weather Service', spec: weatherSpec, prefix: 'wx' },
      ];

      const { config } = composeAPIs(apis);
      const toolNames = config.tools.map(t => t.name);
      expect(toolNames[0]).toMatch(/^wx_/);
    });

    it('should disable specified tools', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec, disabledTools: ['getForecast'] },
      ];

      const { config } = composeAPIs(apis);
      expect(config.tools).toHaveLength(1);
      expect(config.tools[0].name).toBe('weather_getcurrentweather');
    });
  });

  describe('three+ APIs', () => {
    it('should compose three APIs', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
        { name: 'github', spec: githubSpec },
      ];

      const { config, errors } = composeAPIs(apis);

      expect(errors).toHaveLength(0);
      expect(config.tools).toHaveLength(6); // 2 + 3 + 1
      expect(config.envVars.map(v => v.name)).toContain('GITHUB_API_BASE_URL');
      expect(config.envVars.map(v => v.name)).toContain('GITHUB_API_BEARER_TOKEN');
    });
  });

  describe('error handling', () => {
    it('should return error for empty APIs array', () => {
      const { config, errors } = composeAPIs([]);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('No APIs');
      expect(config.tools).toHaveLength(0);
    });

    it('should return error for too many APIs', () => {
      const apis = Array.from({ length: 21 }, (_, i) => ({
        name: `api${i}`,
        spec: weatherSpec,
      }));
      const { errors } = composeAPIs(apis);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Too many');
    });

    it('should return error for duplicate API names', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'weather', spec: calendarSpec },
      ];
      const { errors } = composeAPIs(apis);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate');
    });

    it('should skip invalid specs and continue with valid ones', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'broken', spec: 'not a spec at all {{{' },
      ];

      const { config, errors } = composeAPIs(apis);

      expect(errors).toHaveLength(1);
      expect(errors[0].api).toBe('broken');
      expect(config.tools.length).toBe(2); // weather tools still there
    });

    it('should return error when all specs are invalid', () => {
      const apis: APISource[] = [
        { name: 'bad1', spec: 'invalid' },
        { name: 'bad2', spec: '{}' },
      ];

      const { config, errors } = composeAPIs(apis);
      expect(errors.length).toBeGreaterThan(0);
      expect(config.tools).toHaveLength(0);
    });
  });

  describe('conflict resolution', () => {
    it('should handle APIs with same endpoint structures without collisions', () => {
      // Two APIs that both have /events endpoints
      const api1 = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Events A', version: '1.0.0' },
        servers: [{ url: 'https://a.com' }],
        paths: {
          '/events': {
            get: {
              operationId: 'listEvents',
              summary: 'List events A',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });

      const api2 = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Events B', version: '1.0.0' },
        servers: [{ url: 'https://b.com' }],
        paths: {
          '/events': {
            get: {
              operationId: 'listEvents',
              summary: 'List events B',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });

      const { config, errors } = composeAPIs([
        { name: 'eventsA', spec: api1 },
        { name: 'eventsB', spec: api2 },
      ]);

      expect(errors).toHaveLength(0);
      expect(config.tools).toHaveLength(2);
      expect(config.tools[0].name).toBe('eventsa_listevents');
      expect(config.tools[1].name).toBe('eventsb_listevents');
    });

    it('should preserve correct base URLs per tool', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config } = composeAPIs(apis);

      const weatherTool = config.tools.find(t => t.name.startsWith('weather_'));
      expect(weatherTool?.handler.baseUrl).toBe('https://api.weather.com');

      const calendarTool = config.tools.find(t => t.name.startsWith('calendar_'));
      expect(calendarTool?.handler.baseUrl).toBe('https://api.calendar.io');
    });
  });

  describe('auth composition', () => {
    it('should prefix auth env vars per API', () => {
      const apis: APISource[] = [
        { name: 'calendar', spec: calendarSpec },
        { name: 'github', spec: githubSpec },
      ];

      const { config } = composeAPIs(apis);

      // Calendar auth
      const calendarTool = config.tools.find(t => t.name === 'calendar_listevents');
      expect(calendarTool?.handler.auth[0].envVar).toBe('CALENDAR_API_BEARER_TOKEN');

      // GitHub auth
      const githubTool = config.tools.find(t => t.name === 'github_getrepo');
      expect(githubTool?.handler.auth[0].envVar).toBe('GITHUB_API_BEARER_TOKEN');
    });
  });

  describe('generated server config', () => {
    it('should produce a valid config for code generation', () => {
      const apis: APISource[] = [
        { name: 'weather', spec: weatherSpec },
        { name: 'calendar', spec: calendarSpec },
      ];

      const { config } = composeAPIs(apis, 'my-combo-server');

      // Config should be valid MCPServerConfig
      expect(config.name).toBe('my-combo-server');
      expect(config.version).toBe('1.0.0');
      expect(config.tools.length).toBeGreaterThan(0);
      expect(config.envVars.length).toBeGreaterThan(0);

      // Each tool should have required fields
      for (const tool of config.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.handler.method).toBeTruthy();
        expect(tool.handler.path).toBeTruthy();
      }
    });
  });
});
