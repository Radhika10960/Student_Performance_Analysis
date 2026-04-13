document.addEventListener('DOMContentLoaded', () => {

    // --- Dashboard Initial Data Fetch ---
    fetchDashboardData();

    // --- DOM Elements for Prediction ---
    const form = document.getElementById('predictionForm');
    const submitBtn = document.getElementById('submitBtn');
    const loadingDiv = document.getElementById('loading');
    
    const emptyState = document.getElementById('emptyState');
    const predictionView = document.getElementById('predictionView');
    
    const scoreValue = document.getElementById('predictedScoreValue');
    const performanceLevelBadge = document.getElementById('performanceLevelBadge');
    const recommendationList = document.getElementById('recommendationList');
    const scoreDisplayContainer = document.querySelector('.score-display');

    // Chart instances
    let hoursChartInstance = null;
    let attendanceChartInstance = null;
    let featBarChartInstance = null; // Used in the right panel

    // --- Prediction Submit Handler ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI Loading state
        submitBtn.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        
        const formData = {
            hours: form.hours.value,
            attendance: form.attendance.value,
            prev_score: form.prev_score.value
        };

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            setTimeout(() => {
                loadingDiv.classList.add('hidden');
                submitBtn.classList.remove('hidden');
                
                if (result.success) {
                    emptyState.classList.add('hidden');
                    predictionView.classList.remove('hidden');
                    displayResults(result, formData);
                } else {
                    alert('An error occurred during prediction.');
                }
            }, 600);
            
        } catch (error) {
            console.error('Error fetching prediction:', error);
            loadingDiv.classList.add('hidden');
            submitBtn.classList.remove('hidden');
            alert('Failed to connect to the server.');
        }
    });
    
    
    // --- Display Prediction Results ---
    function displayResults(data, inputData) {
        animateValue(scoreValue, 0, data.predicted_score, 1000);
        performanceLevelBadge.textContent = data.level;
        
        scoreDisplayContainer.classList.remove('theme-green', 'theme-yellow', 'theme-red');
        if (data.color === 'green') scoreDisplayContainer.classList.add('theme-green');
        else if (data.color === 'yellow') scoreDisplayContainer.classList.add('theme-yellow');
        else scoreDisplayContainer.classList.add('theme-red');
        
        recommendationList.innerHTML = '';
        data.recommendations.forEach(rec => {
            const li = document.createElement('li');
            let iconClass = 'fa-lightbulb';
            if (rec.toLowerCase().includes('attendance')) iconClass = 'fa-calendar';
            if (rec.toLowerCase().includes('hours')) iconClass = 'fa-clock';
            if (rec.toLowerCase().includes('revising')) iconClass = 'fa-book-open';
            if (rec.toLowerCase().includes('good work')) iconClass = 'fa-star';
            
            li.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${rec}</span>`;
            recommendationList.appendChild(li);
        });

        // Update the mini-chart in the right panel comparing the user input against max values
        renderMiniBarChart(inputData);
    }
    
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = (progress * (end - start) + start).toFixed(1);
            if (progress < 1) window.requestAnimationFrame(step);
            else obj.innerHTML = end.toFixed(1);
        };
        window.requestAnimationFrame(step);
    }

    // --- Dashboard Data Fetch and Charts Render ---
    async function fetchDashboardData() {
        try {
            const res = await fetch('/api/dashboard_data');
            const data = await res.json();

            // Populate Top Metrics
            document.getElementById('totalStudentsValue').innerText = data.metrics.total_students;
            document.getElementById('avgScoreValue').innerText = data.metrics.avg_score + '%';

            // Populate 3D Cards Middle Row Feature Importance
            const imp = data.charts.featureImportance.data; // array [hours, attendance, prev]
            document.getElementById('feat-hours').innerText = imp[0] + '%';
            document.getElementById('feat-attendance').innerText = imp[1] + '%';
            document.getElementById('feat-prev').innerText = imp[2] + '%';

            // Render Main Charts
            renderHoursScatter(data.charts.hoursVsScore);
            renderAttendanceScatter(data.charts.attendanceVsScore);
            
        } catch(e) {
            console.error("Dashboard Data fetch failed", e);
        }
    }

    // --- Chart.js Setups ---
    Chart.defaults.color = '#8b92b2';
    Chart.defaults.font.family = 'Inter';

    function renderHoursScatter(dataPoints) {
        const ctx = document.getElementById('hoursChart').getContext('2d');
        if(hoursChartInstance) hoursChartInstance.destroy();

        hoursChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Score vs Hours',
                    data: dataPoints,
                    backgroundColor: 'rgba(77, 119, 255, 0.6)',
                    borderColor: '#4d77ff',
                    borderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Hours' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Score' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderAttendanceScatter(dataPoints) {
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        if(attendanceChartInstance) attendanceChartInstance.destroy();

        attendanceChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Score vs Attendance',
                    data: dataPoints,
                    backgroundColor: 'rgba(157, 78, 221, 0.6)', // purple map
                    borderColor: '#9d4edd',
                    borderWidth: 1,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Attendance %' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Score %' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderMiniBarChart(inputData) {
        const ctx = document.getElementById('featureBarChart').getContext('2d');
        if(featBarChartInstance) featBarChartInstance.destroy();

        featBarChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Hours (max 40)', 'Att. %', 'Prev %'],
                datasets: [{
                    data: [
                        Math.min(inputData.hours, 40) / 40 * 100, // Normalized to 100% just for visualization
                        inputData.attendance,
                        inputData.prev_score
                    ],
                    backgroundColor: ['#4d77ff', '#9d4edd', '#ff4d6d'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { max: 100, display: false, grid: {display: false} },
                    y: { grid: {display: false} }
                },
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

});
