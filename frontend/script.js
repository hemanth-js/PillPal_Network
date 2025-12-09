// API Base URL - Change this to your backend URL
const API_URL ='https://pillpal-network-1.onrender.com';

// Global state
let medicines = [];
let impactMetrics = {};
let selectedCategory = 'All';
let selectedMedicine = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadMedicines();
    loadMetrics();
});

// Load medicines from backend
async function loadMedicines() {
    try {
        const response = await fetch(`${API_URL}/api/medicines`);
        if (!response.ok) {
            throw new Error('Failed to load medicines');
        }
        medicines = await response.json();
        renderMedicines();
    } catch (error) {
        alert('Failed to load medicines. Please check your connection.');
        console.error(error);
    }
}

// Load metrics from backend
async function loadMetrics() {
    try {
        const response = await fetch(`${API_URL}/api/metrics`);
        if (!response.ok) {
            throw new Error('Failed to load metrics');
        }
        impactMetrics = await response.json();
        renderMetrics();
    } catch (error) {
        alert('Failed to load metrics. Please check your connection.');
        console.error(error);
    }
}

// Render medicines
function renderMedicines() {
    const grid = document.getElementById('medicineGrid');
    const noResults = document.getElementById('noResults');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = medicines.filter(med => {
        const matchesSearch = med.name.toLowerCase().includes(searchTerm) || 
                            med.location.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
        return matchesSearch && matchesCategory && med.status === 'available';
    });

    if (filtered.length === 0) {
        grid.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    noResults.style.display = 'none';

    grid.innerHTML = filtered.map(med => `
        <div class="medicine-card">
            <div class="medicine-header">
                <h3>${med.name}</h3>
                <span class="category-badge">${med.category}</span>
            </div>
            <div class="medicine-body">
                <div class="medicine-details">
                    <div class="detail-item">
                        <i class="fas fa-box"></i>
                        <span>Quantity: <strong>${med.quantity} units</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>Expires: <strong>${med.expiry}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span><strong>${med.location}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-award"></i>
                        <span>By: <strong>${med.donor}</strong></span>
                    </div>
                </div>
                <button class="btn-primary btn-full" onclick="openRequestModal('${med._id}')">
                    Request Medicine
                </button>
            </div>
        </div>
    `).join('');
}

// Filter medicines
function filterMedicines() {
    renderMedicines();
}

function filterByCategory(category) {
    selectedCategory = category;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderMedicines();
}

// Modal functions
function openDonateModal() {
    document.getElementById('donateModal').classList.add('active');
}

function closeDonateModal() {
    document.getElementById('donateModal').classList.remove('active');
    clearDonateForm();
}

function openRequestModal(medicineId) {
    selectedMedicine = medicines.find(m => m._id === medicineId);
    if (!selectedMedicine) return;

    const details = document.getElementById('requestDetails');
    details.innerHTML = `
        <h3>${selectedMedicine.name}</h3>
        <p>Quantity: ${selectedMedicine.quantity} units</p>
        <p>Location: ${selectedMedicine.location}</p>
        <p>Donor: ${selectedMedicine.donor}</p>
    `;

    document.getElementById('requestModal').classList.add('active');
}

function closeRequestModal() {
    document.getElementById('requestModal').classList.remove('active');
    selectedMedicine = null;
}

// Submit donation
async function submitDonation() {
    const name = document.getElementById('medicineName').value.trim();
    const category = document.getElementById('medicineCategory').value;
    const quantity = parseInt(document.getElementById('medicineQuantity').value);
    const expiry = document.getElementById('medicineExpiry').value;
    const location = document.getElementById('medicineLocation').value.trim();

    if (!name || !quantity || !expiry || !location) {
        alert('Please fill all fields');
        return;
    }

    const newMedicine = {
        name,
        category,
        quantity,
        expiry,
        location,
        donor: 'You',
        status: 'available'
    };

    try {
        const response = await fetch(`${API_URL}/api/medicines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMedicine)
        });

        if (!response.ok) {
            throw new Error('Failed to donate medicine');
        }

        const savedMedicine = await response.json();
        medicines.push(savedMedicine);

        // Reload metrics after donation
        await loadMetrics();

        closeDonateModal();
        renderMedicines();
        alert('Medicine donated successfully!');
    } catch (error) {
        alert('Failed to donate medicine. Please try again.');
        console.error(error);
    }
}

// Confirm request
async function confirmRequest() {
    if (!selectedMedicine) return;

    try {
        const response = await fetch(`${API_URL}/api/medicines/${selectedMedicine._id}/request`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to submit request');
        }

        selectedMedicine.status = 'matched';

        // Reload metrics after request
        await loadMetrics();

        closeRequestModal();
        renderMedicines();
        alert('Request submitted successfully! You will be contacted by our verified partner soon.');
    } catch (error) {
        alert('Failed to submit request. Please try again.');
        console.error(error);
    }
}

function renderMetrics() {
    document.getElementById('medicinesCount').textContent = impactMetrics.medicinesRedistributed;
    document.getElementById('wasteCount').textContent = impactMetrics.wastePreventedKg + 'kg';
    document.getElementById('peopleCount').textContent = impactMetrics.peopleHelped;
    document.getElementById('co2Count').textContent = impactMetrics.co2SavedKg + 'kg';
}

// Clear donate form
function clearDonateForm() {
    document.getElementById('medicineName').value = '';
    document.getElementById('medicineCategory').value = 'Pain Relief';
    document.getElementById('medicineQuantity').value = '';
    document.getElementById('medicineExpiry').value = '';
    document.getElementById('medicineLocation').value = '';
}

// Close modals on outside click
window.onclick = function(event) {
    const donateModal = document.getElementById('donateModal');
    const requestModal = document.getElementById('requestModal');
    
    if (event.target === donateModal) {
        closeDonateModal();
    }
    if (event.target === requestModal) {
        closeRequestModal();
    }
}