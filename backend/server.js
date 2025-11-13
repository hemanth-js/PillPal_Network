// Backend Server - Node.js + Express + MongoDB
// Install dependencies: npm install express mongoose cors dotenv body-parser

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shubhashreer2439:Shree2439@cluster0.p8hbcku.mongodb.net/carecycle?appName=Cluster0';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Medicine Schema
const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['Pain Relief', 'Antibiotics', 'Chronic Disease', 'Vitamins', 'First Aid']
    },
    quantity: { type: Number, required: true, min: 1 },
    expiry: { type: Date, required: true },
    location: { type: String, required: true },
    donor: { type: String, default: 'Anonymous' },
    status: { 
        type: String, 
        default: 'available',
        enum: ['available', 'matched', 'completed']
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Medicine = mongoose.model('Medicine', medicineSchema);

// Request Schema
const requestSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: { type: String, required: true },
    requesterName: { type: String },
    requesterEmail: { type: String },
    requesterPhone: { type: String },
    status: { 
        type: String, 
        default: 'pending',
        enum: ['pending', 'approved', 'rejected', 'completed']
    },
    createdAt: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', requestSchema);

// Impact Metrics Schema
const metricsSchema = new mongoose.Schema({
    medicinesRedistributed: { type: Number, default: 0 },
    wastePreventedKg: { type: Number, default: 0 },
    peopleHelped: { type: Number, default: 0 },
    co2SavedKg: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

const Metrics = mongoose.model('Metrics', metricsSchema);

// ============== ROUTES ==============

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'PillPal API is running' });
});

// Get all medicines
app.get('/api/medicines', async (req, res) => {
    try {
        const { category, location, status } = req.query;
        let query = {};

        if (category && category !== 'All') {
            query.category = category;
        }
        if (location) {
            query.location = new RegExp(location, 'i');
        }
        if (status) {
            query.status = status;
        } else {
            query.status = 'available'; // Default to available only
        }

        const medicines = await Medicine.find(query).sort({ createdAt: -1 });
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch medicines', details: error.message });
    }
});

// Get single medicine
app.get('/api/medicines/:id', async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ error: 'Medicine not found' });
        }
        res.json(medicine);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch medicine', details: error.message });
    }
});

// Create new medicine donation
app.post('/api/medicines', async (req, res) => {
    try {
        const { name, category, quantity, expiry, location, donor } = req.body;

        // Validation
        if (!name || !category || !quantity || !expiry || !location) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const medicine = new Medicine({
            name,
            category,
            quantity,
            expiry,
            location,
            donor: donor || 'Anonymous'
        });

        await medicine.save();

        // Update metrics
        await updateMetrics('donate');

        res.status(201).json(medicine);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create medicine', details: error.message });
    }
});

// Request medicine
app.post('/api/medicines/:id/request', async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        
        if (!medicine) {
            return res.status(404).json({ error: 'Medicine not found' });
        }

        if (medicine.status !== 'available') {
            return res.status(400).json({ error: 'Medicine is not available' });
        }

        // Create request
        const request = new Request({
            medicineId: medicine._id,
            medicineName: medicine.name,
            requesterName: req.body.name,
            requesterEmail: req.body.email,
            requesterPhone: req.body.phone
        });

        await request.save();

        // Update medicine status
        medicine.status = 'matched';
        medicine.updatedAt = Date.now();
        await medicine.save();

        // Update metrics
        await updateMetrics('request');

        res.json({ message: 'Request submitted successfully', request });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit request', details: error.message });
    }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
    try {
        const requests = await Request.find()
            .populate('medicineId')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch requests', details: error.message });
    }
});

// Update request status
app.patch('/api/requests/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const request = await Request.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update request', details: error.message });
    }
});

// Get impact metrics
app.get('/api/metrics', async (req, res) => {
    try {
        let metrics = await Metrics.findOne();
        
        if (!metrics) {
            // Initialize metrics if not exist
            metrics = new Metrics({
                medicinesRedistributed: 0,
                wastePreventedKg: 0,
                peopleHelped: 0,
                co2SavedKg: 0
            });
            await metrics.save();
        }

        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics', details: error.message });
    }
});

// Update metrics helper function
async function updateMetrics(type) {
    try {
        let metrics = await Metrics.findOne();
        
        if (!metrics) {
            metrics = new Metrics();
        }

        if (type === 'donate') {
            metrics.medicinesRedistributed += 1;
            metrics.wastePreventedKg = parseFloat((metrics.wastePreventedKg + 0.3).toFixed(1));
        } else if (type === 'request') {
            metrics.peopleHelped += 1;
            metrics.co2SavedKg = parseFloat((metrics.co2SavedKg + 0.2).toFixed(1));
        }

        metrics.lastUpdated = Date.now();
        await metrics.save();
    } catch (error) {
        console.error('Failed to update metrics:', error);
    }
}

// Delete medicine (admin only)
app.delete('/api/medicines/:id', async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndDelete(req.params.id);
        if (!medicine) {
            return res.status(404).json({ error: 'Medicine not found' });
        }
        res.json({ message: 'Medicine deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete medicine', details: error.message });
    }
});

// Search medicines
app.get('/api/medicines/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const medicines = await Medicine.find({
            $or: [
                { name: new RegExp(query, 'i') },
                { location: new RegExp(query, 'i') },
                { category: new RegExp(query, 'i') }
            ],
            status: 'available'
        });
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 PillPal API running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;