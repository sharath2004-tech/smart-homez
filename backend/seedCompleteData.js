import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Location from './models/Location.js';
import Service from './models/Service.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear all data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Location.deleteMany({});
    await Service.deleteMany({});
    console.log('✅ All data cleared\n');

    // Create Super Admin
    console.log('👑 Creating Super Admin...');
    const superAdmin = new User({
      name: 'Super Admin',
      email: 'superadmin@healthyhomez.com',
      password: 'admin123',
      phone: '+91 9999999999',
      role: 'super_admin',
      isActive: true,
      isVerified: true
    });
    await superAdmin.save();
    console.log(`✅ Super Admin created: ${superAdmin.email} / admin123\n`);

    // Create Locations
    console.log('📍 Creating Locations...');
    const locations = [
      {
        apartmentName: 'Phoenix Mall',
        building: 'Tower A',
        area: 'Velachery',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600042',
        coordinates: [80.2207, 12.9716], // [lng, lat]
        maxServiceRadius: 500
      },
      {
        apartmentName: 'Express Avenue',
        building: 'Main Block',
        area: 'Royapettah',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600014',
        coordinates: [80.2619, 13.0569],
        maxServiceRadius: 500
      },
      {
        apartmentName: 'Inorbit Mall',
        building: 'Block B',
        area: 'Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500081',
        coordinates: [78.3908, 17.4326],
        maxServiceRadius: 500
      },
      {
        apartmentName: 'Forum Mall',
        building: 'Tower 1',
        area: 'Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560095',
        coordinates: [77.6117, 12.9352],
        maxServiceRadius: 500
      }
    ];

    const createdLocations = [];
    for (const locData of locations) {
      const location = new Location({
        ...locData,
        location: {
          type: 'Point',
          coordinates: locData.coordinates
        },
        createdBy: superAdmin._id,
        isActive: true,
        isServiceAvailable: true // Service available at all created locations
      });
      await location.save();
      createdLocations.push(location);
      console.log(`   ✅ ${location.apartmentName} - ${location.area}, ${location.city}`);
    }
    console.log('');

    // Create Location Admins
    console.log('👤 Creating Location Admins...');
    const admins = [
      {
        name: 'Chennai Admin',
        email: 'admin.chennai@healthyhomez.com',
        password: 'admin123',
        phone: '+91 9876543210',
        locationIndices: [0, 1] // Phoenix Mall, Express Avenue
      },
      {
        name: 'Hyderabad Admin',
        email: 'admin.hyderabad@healthyhomez.com',
        password: 'admin123',
        phone: '+91 9876543211',
        locationIndices: [2] // Inorbit Mall
      },
      {
        name: 'Bangalore Admin',
        email: 'admin.bangalore@healthyhomez.com',
        password: 'admin123',
        phone: '+91 9876543212',
        locationIndices: [3] // Forum Mall
      }
    ];

    const createdAdmins = [];
    for (const adminData of admins) {
      const assignedLocs = adminData.locationIndices.map(i => createdLocations[i]);
      const admin = new User({
        name: adminData.name,
        email: adminData.email,
        password: adminData.password,
        phone: adminData.phone,
        role: 'admin',
        isActive: true,
        isVerified: true,
        adminProfile: {
          assignedLocations: assignedLocs.map(loc => ({
            locationId: loc._id,
            locationName: loc.apartmentName,
            area: loc.area,
            city: loc.city
          })),
          permissions: {
            canCreateWorkers: true,
            canDeleteWorkers: true,
            canManageApartments: true,
            canViewReports: true
          },
          createdBy: superAdmin._id
        }
      });
      await admin.save();
      createdAdmins.push(admin);

      // Update locations with admin assignment
      for (const loc of assignedLocs) {
        await Location.findByIdAndUpdate(loc._id, { assignedAdmin: admin._id });
      }

      console.log(`   ✅ ${admin.name} (${admin.email}) - Manages: ${assignedLocs.map(l => l.apartmentName).join(', ')}`);
    }
    console.log('');

    // Create Workers
    console.log('👷 Creating Workers...');
    const workers = [
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.worker@healthyhomez.com',
        phone: '+91 9123456780',
        gender: 'male',
        specialization: ['Cleaning', 'Deep Clean', 'Kitchen'],
        experience: 5,
        locationIndices: [0] // Phoenix Mall
      },
      {
        name: 'Priya Sharma',
        email: 'priya.worker@healthyhomez.com',
        phone: '+91 9123456781',
        gender: 'female',
        specialization: ['Bathroom', 'Window', 'Laundry'],
        experience: 3,
        locationIndices: [0, 1] // Phoenix Mall, Express Avenue
      },
      {
        name: 'Venkat Reddy',
        email: 'venkat.worker@healthyhomez.com',
        phone: '+91 9123456782',
        gender: 'male',
        specialization: ['Sofa', 'Carpet', 'Deep Clean'],
        experience: 7,
        locationIndices: [2] // Inorbit Mall
      },
      {
        name: 'Lakshmi Devi',
        email: 'lakshmi.worker@healthyhomez.com',
        phone: '+91 9123456783',
        gender: 'female',
        specialization: ['Cleaning', 'Kitchen', 'Bathroom'],
        experience: 4,
        locationIndices: [2] // Inorbit Mall
      },
      {
        name: 'Suresh Babu',
        email: 'suresh.worker@healthyhomez.com',
        phone: '+91 9123456784',
        gender: 'male',
        specialization: ['Window', 'Deep Clean', 'Carpet'],
        experience: 6,
        locationIndices: [3] // Forum Mall
      }
    ];

    for (const workerData of workers) {
      const assignedLocs = workerData.locationIndices.map(i => createdLocations[i]);
      const worker = new User({
        name: workerData.name,
        email: workerData.email,
        password: 'worker123',
        phone: workerData.phone,
        gender: workerData.gender,
        role: 'worker',
        isActive: true,
        isVerified: true,
        workerProfile: {
          specialization: workerData.specialization,
          experience: workerData.experience,
          hourlyRate: 150,
          rating: 4.5,
          totalReviews: 10,
          availability: true,
          serviceRadius: 500,
          assignedApartments: assignedLocs.map(loc => ({
            locationId: loc._id,
            apartmentName: loc.apartmentName,
            building: loc.building,
            area: loc.area,
            city: loc.city,
            location: loc.location,
            maxWalkingDistance: 500
          }))
        }
      });
      await worker.save();

      // Update locations with worker assignment
      for (const loc of assignedLocs) {
        await Location.findByIdAndUpdate(loc._id, {
          $push: { assignedWorkers: { worker: worker._id, assignedAt: new Date() } }
        });
      }

      console.log(`   ✅ ${worker.name} (${worker.email}) - Works at: ${assignedLocs.map(l => l.apartmentName).join(', ')}`);
    }
    console.log('');

    // Create Services
    console.log('🧹 Creating Services...');
    const services = [
      {
        name: 'Basic House Cleaning',
        category: 'cleaning',
        description: 'Complete house cleaning including dusting, mopping, and vacuuming',
        price: 500,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Deep Cleaning',
        category: 'cleaning',
        description: 'Thorough deep cleaning of entire house including hard-to-reach areas',
        price: 1500,
        duration: 240,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Kitchen Cleaning',
        category: 'cleaning',
        description: 'Complete kitchen cleaning including appliances, cabinets, and countertops',
        price: 600,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Bathroom Cleaning',
        category: 'cleaning',
        description: 'Deep cleaning of bathrooms including tiles, fixtures, and sanitization',
        price: 400,
        duration: 60,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Window Cleaning',
        category: 'cleaning',
        description: 'Professional window cleaning for all windows',
        price: 300,
        duration: 60,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Sofa Cleaning',
        category: 'cleaning',
        description: 'Professional sofa and upholstery cleaning',
        price: 800,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Carpet Cleaning',
        category: 'cleaning',
        description: 'Deep carpet cleaning and stain removal',
        price: 700,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      }
    ];

    for (const serviceData of services) {
      const service = new Service(serviceData);
      await service.save();
      console.log(`   ✅ ${service.name} - ₹${service.price} (${service.duration}min)`);
    }
    console.log('');

    // Summary
    console.log('==================== SEED COMPLETE ====================\n');
    console.log('📊 Summary:');
    console.log(`   • 1 Super Admin`);
    console.log(`   • ${createdAdmins.length} Location Admins`);
    console.log(`   • ${createdLocations.length} Locations`);
    console.log(`   • ${workers.length} Workers`);
    console.log(`   • ${services.length} Services`);
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('');
    console.log('Super Admin:');
    console.log('   Email: superadmin@healthyhomez.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('Chennai Admin (manages Phoenix Mall, Express Avenue):');
    console.log('   Email: admin.chennai@healthyhomez.com');
    console.log('   Password: admin123');
    console.log('   Should see: 2 workers (Rajesh, Priya)');
    console.log('');
    console.log('Hyderabad Admin (manages Inorbit Mall):');
    console.log('   Email: admin.hyderabad@healthyhomez.com');
    console.log('   Password: admin123');
    console.log('   Should see: 2 workers (Venkat, Lakshmi)');
    console.log('');
    console.log('Bangalore Admin (manages Forum Mall):');
    console.log('   Email: admin.bangalore@healthyhomez.com');
    console.log('   Password: admin123');
    console.log('   Should see: 1 worker (Suresh)');
    console.log('');
    console.log('Workers (all use password: worker123):');
    console.log('   • rajesh.worker@healthyhomez.com');
    console.log('   • priya.worker@healthyhomez.com');
    console.log('   • venkat.worker@healthyhomez.com');
    console.log('   • lakshmi.worker@healthyhomez.com');
    console.log('   • suresh.worker@healthyhomez.com');
    console.log('');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedDatabase();
