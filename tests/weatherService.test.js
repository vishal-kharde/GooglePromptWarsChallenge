'use strict';

const weatherService = require('../server/services/weatherService');

describe('Weather Service Unit Tests', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('geocodeCity', () => {
    it('successfully geocodes using WeatherAPI search', async () => {
      const mockSearchResponse = [
        {
          name: 'Pune',
          region: 'Maharashtra',
          country: 'India',
          lat: 18.53,
          lon: 73.87,
          url: 'pune-maharashtra-india'
        }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSearchResponse
      });

      const res = await weatherService.geocodeCity('Pune');
      expect(res).toEqual({
        lat: 18.53,
        lon: 73.87,
        name: 'Pune',
        country: 'India',
        timezone: 'auto'
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search.json?key=b9e84736b2374d798c693623261107&q=Pune'),
        expect.any(Object)
      );
    });

    it('falls back to Photon API if WeatherAPI search fails', async () => {
      const mockPhotonResponse = {
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [72.88, 19.07] // [lon, lat]
            },
            properties: {
              name: 'Mumbai',
              country: 'India'
            }
          }
        ]
      };

      // Mock first call (WeatherAPI) to fail, second call (Photon) to succeed
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('WeatherAPI connect timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPhotonResponse
        });

      const res = await weatherService.geocodeCity('Mumbai');
      expect(res).toEqual({
        lat: 19.07,
        lon: 72.88,
        name: 'Mumbai',
        country: 'India',
        timezone: 'auto'
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('search.json'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('photon.komoot.io/api/?q=Mumbai'),
        expect.any(Object)
      );
    });

    it('returns null if both WeatherAPI search and Photon fallback fail', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('WeatherAPI fail'))
        .mockRejectedValueOnce(new Error('Photon fail'));

      const res = await weatherService.geocodeCity('Nowhere');
      expect(res).toBeNull();
    });
  });

  describe('getForecast', () => {
    it('fetches and maps WeatherAPI forecast data correctly', async () => {
      const mockForecastResponse = {
        location: {
          name: 'Pune',
          region: 'Maharashtra',
          country: 'India',
          lat: 18.53,
          lon: 73.87,
          tz_id: 'Asia/Kolkata'
        },
        current: {
          temp_c: 27.4,
          humidity: 69,
          feelslike_c: 29.4,
          wind_kph: 34.6,
          wind_degree: 259,
          precip_mm: 0.03,
          cloud: 51,
          vis_km: 10.0,
          pressure_mb: 1008.0,
          condition: {
            text: 'Patchy rain nearby',
            code: 1063 // maps to WMO code 51
          }
        },
        forecast: {
          forecastday: [
            {
              date: '2026-07-11',
              day: {
                maxtemp_c: 27.8,
                mintemp_c: 22.8,
                totalprecip_mm: 0.31,
                daily_chance_of_rain: 36,
                maxwind_kph: 35.3,
                condition: {
                  code: 1063
                }
              },
              astro: {
                sunrise: '06:05 AM',
                sunset: '07:15 PM'
              },
              hour: [
                {
                  time: '2026-07-11 00:00',
                  temp_c: 23.2,
                  precip_mm: 0.01,
                  chance_of_rain: 18,
                  wind_kph: 17.6,
                  condition: {
                    code: 1063
                  },
                  vis_km: 10.0,
                  humidity: 86
                }
              ]
            }
          ]
        }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockForecastResponse
      });

      const data = await weatherService.getForecast(18.53, 73.87);

      // Verify overall mapped response
      expect(data.location).toEqual({
        lat: 18.53,
        lon: 73.87,
        timezone: 'Asia/Kolkata'
      });

      // Verify current conditions mapping
      expect(data.current.temperature_2m).toBe(27.4);
      expect(data.current.apparent_temperature).toBe(29.4);
      expect(data.current.relative_humidity_2m).toBe(69);
      expect(data.current.precipitation).toBe(0.03);
      expect(data.current.wind_speed_10m).toBe(34.6);
      expect(data.current.visibility).toBe(10000); // 10 km to 10000 meters
      expect(data.current.surface_pressure).toBe(1008);
      expect(data.current.weather_code).toBe(51); // mapped from 1063
      expect(data.current.weather_info.label).toBe('Light drizzle');
      expect(data.current.risk_level).toBeDefined();

      // Verify daily mapping
      expect(data.daily.time).toEqual(['2026-07-11']);
      expect(data.daily.weather_code).toEqual([51]);
      expect(data.daily.temperature_2m_max).toEqual([27.8]);
      expect(data.daily.temperature_2m_min).toEqual([22.8]);
      expect(data.daily.precipitation_sum).toEqual([0.31]);
      expect(data.daily.precipitation_probability_max).toEqual([36]);
      expect(data.daily.sunrise).toEqual(['06:05 AM']);

      // Verify hourly mapping
      expect(data.hourly.time).toEqual(['2026-07-11 00:00']);
      expect(data.hourly.temperature_2m).toEqual([23.2]);
      expect(data.hourly.precipitation).toEqual([0.01]);
      expect(data.hourly.precipitation_probability).toEqual([18]);
      expect(data.hourly.weather_code).toEqual([51]);
      expect(data.hourly.visibility).toEqual([10000]);
    });
  });

  describe('interpretWeatherCode & calculateRiskLevel helper exports', () => {
    it('correctly exports and computes helpers', () => {
      const info = weatherService.interpretWeatherCode(95);
      expect(info.label).toBe('Thunderstorm');
      expect(info.severity).toBe('storm');

      const risk = weatherService.calculateRiskLevel({
        precipitation: 25,
        wind_speed_10m: 45,
        weather_code: 95,
        relative_humidity_2m: 95
      });
      expect(risk).toBe('extreme');
    });
  });
});
