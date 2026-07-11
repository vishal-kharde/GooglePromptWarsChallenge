'use strict';

/**
 * Database seeder — populates initial shelter data for Indian cities.
 * Run with: node server/db/seed.js
 */

require('dotenv').config();
const { getDb } = require('../services/database');

const SHELTERS = [
  // Mumbai
  { name: 'Bandra BKC Relief Camp', address: 'BKC, Bandra East, Mumbai, MH 400051', lat: 19.0596, lng: 72.8656, capacity: 500, current_occupancy: 120, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '022-26592000' },
  { name: 'Dharavi Community Centre', address: 'Dharavi, Mumbai, MH 400017', lat: 19.0422, lng: 72.8558, capacity: 300, current_occupancy: 45, has_food: 1, has_medical: 0, has_water: 1, has_electricity: 1, contact: '022-24014000' },
  { name: 'Kurla Municipal School', address: 'LBS Marg, Kurla, Mumbai, MH 400070', lat: 19.0728, lng: 72.8826, capacity: 200, current_occupancy: 30, has_food: 1, has_medical: 0, has_water: 1, has_electricity: 0, contact: '022-25034000' },
  { name: 'Andheri Sports Complex', address: 'D.N. Nagar, Andheri West, Mumbai, MH 400053', lat: 19.1197, lng: 72.8466, capacity: 400, current_occupancy: 0, has_food: 0, has_medical: 1, has_water: 1, has_electricity: 1, contact: '022-26765000' },

  // Chennai
  { name: 'Chennai Corporation Camp T.Nagar', address: 'Panagal Park, T.Nagar, Chennai, TN 600017', lat: 13.0418, lng: 80.2341, capacity: 350, current_occupancy: 80, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '044-25384000' },
  { name: 'Egmore Relief Shelter', address: 'Egmore, Chennai, TN 600008', lat: 13.0785, lng: 80.2602, capacity: 250, current_occupancy: 20, has_food: 1, has_medical: 0, has_water: 1, has_electricity: 1, contact: '044-28192000' },
  { name: 'Tambaram Govt Higher Secondary School', address: 'Tambaram, Chennai, TN 600045', lat: 12.9249, lng: 80.1000, capacity: 400, current_occupancy: 0, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '044-22262000' },

  // Kolkata
  { name: 'Howrah District Relief Camp', address: 'Shibpur, Howrah, WB 711102', lat: 22.5697, lng: 88.3105, capacity: 600, current_occupancy: 200, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '033-26382000' },
  { name: 'Salt Lake Community Hall', address: 'Sector V, Salt Lake, Kolkata, WB 700091', lat: 22.5697, lng: 88.4323, capacity: 200, current_occupancy: 10, has_food: 0, has_medical: 0, has_water: 1, has_electricity: 1, contact: '033-23572000' },

  // Hyderabad
  { name: 'GHMC Emergency Shelter Secunderabad', address: 'Trimulgherry, Secunderabad, TS 500015', lat: 17.4449, lng: 78.5051, capacity: 300, current_occupancy: 50, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '040-21111111' },
  { name: 'LB Nagar Relief Centre', address: 'LB Nagar, Hyderabad, TS 500074', lat: 17.3619, lng: 78.5472, capacity: 250, current_occupancy: 0, has_food: 1, has_medical: 0, has_water: 1, has_electricity: 0, contact: '040-24224000' },

  // Bengaluru
  { name: 'BBMP Relief Camp Rajajinagar', address: 'Rajajinagar, Bengaluru, KA 560010', lat: 12.9902, lng: 77.5521, capacity: 200, current_occupancy: 0, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '080-22221188' },
  { name: 'Whitefield Community Shelter', address: 'Whitefield, Bengaluru, KA 560066', lat: 12.9698, lng: 77.7499, capacity: 150, current_occupancy: 0, has_food: 0, has_medical: 0, has_water: 1, has_electricity: 1, contact: '080-28451000' },

  // Ahmedabad
  { name: 'AMC Emergency Camp Sabarmati', address: 'Sabarmati, Ahmedabad, GJ 380005', lat: 23.0395, lng: 72.5827, capacity: 400, current_occupancy: 30, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '079-25502000' },

  // Delhi
  { name: 'SDMC Flood Relief Camp Yamuna Bank', address: 'Yamuna Bank, Delhi 110092', lat: 28.6279, lng: 77.2918, capacity: 500, current_occupancy: 100, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '011-23392000' },
  { name: 'Geeta Colony Relief Centre', address: 'Geeta Colony, Delhi 110031', lat: 28.6669, lng: 77.2756, capacity: 300, current_occupancy: 60, has_food: 1, has_medical: 0, has_water: 1, has_electricity: 1, contact: '011-22123000' },
];

function seed() {
  const db = getDb();

  console.log('🌱 Seeding shelter data...');

  const insert = db.prepare(`
    INSERT OR IGNORE INTO shelters
      (name, address, lat, lng, capacity, current_occupancy, has_food, has_medical, has_water, has_electricity, contact)
    VALUES
      (@name, @address, @lat, @lng, @capacity, @current_occupancy, @has_food, @has_medical, @has_water, @has_electricity, @contact)
  `);

  const insertMany = db.transaction((shelters) => {
    for (const shelter of shelters) {
      insert.run(shelter);
    }
  });

  insertMany(SHELTERS);

  const count = db.prepare('SELECT COUNT(*) as c FROM shelters').get();
  console.log(`✅ Seeded ${count.c} shelters successfully.`);

  // Add sample community reports for demo
  const reportInsert = db.prepare(`
    INSERT OR IGNORE INTO reports (type, lat, lng, description, severity, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleReports = [
    ['flood', 19.0596, 72.8600, 'Knee-deep water near BKC metro station', 'high', 'BKC, Mumbai'],
    ['road_blocked', 19.0728, 72.8826, 'Kurla LBS Marg completely blocked', 'critical', 'Kurla, Mumbai'],
    ['waterlogging', 13.0418, 80.2341, 'T.Nagar main road waterlogged', 'medium', 'T.Nagar, Chennai'],
    ['power_outage', 22.5697, 88.3105, 'Power cut in Howrah since 3 hours', 'high', 'Howrah, Kolkata'],
    ['tree_fallen', 12.9902, 77.5521, 'Large tree blocking Rajajinagar road', 'medium', 'Rajajinagar, Bengaluru'],
  ];

  const insertReports = db.transaction((reports) => {
    for (const r of reports) reportInsert.run(...r);
  });
  insertReports(sampleReports);

  console.log('✅ Sample community reports added.');
}

// Only exit when run directly as a standalone script (e.g. `node server/db/seed.js`).
// When required() inline from the server, do NOT exit — it would kill the server process.
if (require.main === module) {
  seed();
  process.exit(0);
} else {
  seed();
}
