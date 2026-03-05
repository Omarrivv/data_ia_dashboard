// MongoDB initialization script
db = db.getSiblingDB('dashboard-platform');

// Create collections
db.createCollection('users');
db.createCollection('projects');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

db.projects.createIndex({ "userId": 1, "createdAt": -1 });
db.projects.createIndex({ "name": "text", "description": "text" });
db.projects.createIndex({ "status": 1 });

// Create a default admin user (optional)
db.users.insertOne({
  name: "Admin User",
  email: "admin@dashboardplatform.com",
  password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq/3/Hm", // password: admin123
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Database initialized successfully!');