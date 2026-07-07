/**
 * EcoRoute AI — Core JavaScript Engine
 * Aligned with UN SDG 11 (Sustainable Cities) & SDG 13 (Climate Action)
 */

// ==========================================
// 1. DATABASE MANAGER (localStorage Wrapper)
// ==========================================
class DatabaseManager {
  constructor() {
    this.initTables();
  }

  initTables() {
    if (!localStorage.getItem('ecoroute_users')) {
      const defaultUsers = [
        {
          id: 1,
          name: "Default Commuter",
          city: "Bengaluru",
          preferred_mode: "metro",
          weight_time: 0.33,
          weight_cost: 0.33,
          weight_emissions: 0.34,
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem('ecoroute_users', JSON.stringify(defaultUsers));
      localStorage.setItem('ecoroute_current_user', '1');
    }
    if (!localStorage.getItem('ecoroute_commute_history')) {
      localStorage.setItem('ecoroute_commute_history', JSON.stringify([]));
    }
  }

  getCurrentUserId() {
    return parseInt(localStorage.getItem('ecoroute_current_user') || '1');
  }

  setCurrentUser(userId) {
    localStorage.setItem('ecoroute_current_user', userId.toString());
  }

  addUser(name, city, preferredMode, wt, wc, we) {
    const users = this.getAllUsers();
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      name,
      city,
      preferred_mode: preferredMode,
      weight_time: parseFloat(wt),
      weight_cost: parseFloat(wc),
      weight_emissions: parseFloat(we),
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem('ecoroute_users', JSON.stringify(users));
    return newId;
  }

  getUser(userId) {
    const users = this.getAllUsers();
    return users.find(u => u.id === parseInt(userId)) || null;
  }

  getAllUsers() {
    return JSON.parse(localStorage.getItem('ecoroute_users') || '[]');
  }

  logCommute(userId, origin, destination, distanceKm, mode, travelTimeMin, costInr, emissionsGco2) {
    const history = this.getCommuteHistory();
    const newId = history.length > 0 ? Math.max(...history.map(h => h.id)) + 1 : 1;
    const record = {
      id: newId,
      user_id: parseInt(userId),
      origin,
      destination,
      distance_km: parseFloat(distanceKm),
      mode,
      travel_time_min: parseFloat(travelTimeMin),
      cost_inr: parseFloat(costInr),
      emissions_gco2: parseFloat(emissionsGco2),
      date: new Date().toISOString().split('T')[0]
    };
    history.push(record);
    localStorage.setItem('ecoroute_commute_history', JSON.stringify(history));
    return newId;
  }

  getCommuteHistory(userId = null) {
    const history = JSON.parse(localStorage.getItem('ecoroute_commute_history') || '[]');
    if (userId !== null) {
      return history.filter(h => h.user_id === parseInt(userId));
    }
    return history;
  }

  clearHistory() {
    localStorage.setItem('ecoroute_commute_history', JSON.stringify([]));
  }

  getTotalSavings(userId = null) {
    const history = this.getCommuteHistory(userId);
    let totalCommutes = history.length;
    let totalDistance = 0;
    let totalEmissions = 0;
    let emissionsIfCar = 0;

    history.forEach(item => {
      totalDistance += item.distance_km;
      totalEmissions += item.emissions_gco2;
      // Petrol car baseline is 170gCO2/km
      emissionsIfCar += (170 * item.distance_km);
    });

    const co2Saved = emissionsIfCar - totalEmissions;
    // 1 tree absorbs 21,000 gCO2 per year
    const treesEquivalent = co2Saved / 21000;

    return {
      total_commutes: totalCommutes,
      total_distance_km: parseFloat(totalDistance.toFixed(2)),
      total_emissions_gco2: parseFloat(totalEmissions.toFixed(2)),
      emissions_if_car_gco2: parseFloat(emissionsIfCar.toFixed(2)),
      co2_saved_gco2: parseFloat(co2Saved.toFixed(2)),
      trees_equivalent: parseFloat(treesEquivalent.toFixed(4))
    };
  }
}

// ==========================================
// 2. CARBON EMISSION CALCULATOR
// ==========================================
class EmissionCalculator {
  constructor() {
    this.EMISSION_FACTORS = {
      'car_petrol': 170, 'car_diesel': 155, 'car_cng': 110, 'electric_vehicle': 50,
      'motorcycle': 90, 'auto_rickshaw': 75,
      'bus': 45, 'metro': 20, 'local_train': 25,
      'carpool_2': 85, 'carpool_3': 57, 'carpool_4': 43,
      'bicycle': 0, 'walking': 0, 'e_scooter': 15
    };

    this.COST_PER_KM = {
      'car_petrol': 8.5, 'car_diesel': 7.0, 'car_cng': 5.0, 'electric_vehicle': 2.5,
      'motorcycle': 3.0, 'auto_rickshaw': 12.0,
      'bus': 1.5, 'metro': 3.0, 'local_train': 1.2,
      'carpool_2': 4.25, 'carpool_3': 2.83, 'carpool_4': 2.13,
      'bicycle': 0.0, 'walking': 0.0, 'e_scooter': 1.0
    };

    this.AVERAGE_SPEED_KMPH = {
      'car_petrol': 25, 'car_diesel': 25, 'car_cng': 25, 'electric_vehicle': 30,
      'motorcycle': 30, 'auto_rickshaw': 20,
      'bus': 18, 'metro': 35, 'local_train': 40,
      'carpool_2': 25, 'carpool_3': 25, 'carpool_4': 25,
      'bicycle': 15, 'walking': 5, 'e_scooter': 20
    };
  }

  calculateEmissions(mode, distanceKm) {
    const factor = this.EMISSION_FACTORS[mode] || 0;
    return factor * distanceKm;
  }

  calculateCost(mode, distanceKm) {
    const rate = this.COST_PER_KM[mode] || 0;
    return rate * distanceKm;
  }

  calculateTravelTime(mode, distanceKm, congestionFactor = 1.0) {
    const speed = this.AVERAGE_SPEED_KMPH[mode] || 15;
    
    // Train modes (metro, local train) and active modes (walking, cycling) are congestion-free
    const isRoadBased = ['car_petrol', 'car_diesel', 'car_cng', 'electric_vehicle', 'motorcycle', 'auto_rickshaw', 'bus', 'carpool_2', 'carpool_3', 'carpool_4', 'e_scooter'].includes(mode);
    const appliedCongestion = isRoadBased ? congestionFactor : 1.0;
    
    const timeHours = distanceKm / (speed / appliedCongestion);
    return timeHours * 60; // return minutes
  }

  compareAllModes(distanceKm, congestionFactor = 1.0) {
    return Object.keys(this.EMISSION_FACTORS).map(mode => {
      return {
        mode,
        emissions_gco2: this.calculateEmissions(mode, distanceKm),
        cost_inr: this.calculateCost(mode, distanceKm),
        travel_time_min: this.calculateTravelTime(mode, distanceKm, congestionFactor)
      };
    });
  }

  getModeDisplayName(mode) {
    const names = {
      'car_petrol': '🚗 Petrol Car',
      'car_diesel': '🚙 Diesel Car',
      'car_cng': '🚖 CNG Car',
      'electric_vehicle': '⚡ Electric Vehicle',
      'motorcycle': '🏍️ Motorcycle',
      'auto_rickshaw': '🛺 Auto Rickshaw',
      'bus': '🚌 Public Bus',
      'metro': '🚇 Metro Train',
      'local_train': '🚂 Local Train',
      'carpool_2': '👥 Carpool (2 Pax)',
      'carpool_3': '👥 Carpool (3 Pax)',
      'carpool_4': '👥 Carpool (4 Pax)',
      'bicycle': '🚲 Bicycle',
      'walking': '🚶 Walking',
      'e_scooter': '🛵 E-Scooter'
    };
    return names[mode] || mode;
  }

  getAllModes() {
    return Object.keys(this.EMISSION_FACTORS);
  }
}

// ==========================================
// 3. MULTI-CRITERIA DECISION MAKER
// ==========================================
class RouteRecommender {
  constructor(calculator) {
    this.calculator = calculator;
  }

  rankRoutes(distanceKm, wt = 0.33, wc = 0.33, we = 0.34, congestionFactor = 1.0, availableModes = null) {
    let comparison = this.calculator.compareAllModes(distanceKm, congestionFactor);
    
    // Filter by available modes
    if (availableModes && availableModes.length > 0) {
      comparison = comparison.filter(item => availableModes.includes(item.mode));
    }

    if (comparison.length === 0) return [];

    // Min-Max values for normalization
    const maxTime = Math.max(...comparison.map(i => i.travel_time_min));
    const minTime = Math.min(...comparison.map(i => i.travel_time_min));
    const maxCost = Math.max(...comparison.map(i => i.cost_inr));
    const minCost = Math.min(...comparison.map(i => i.cost_inr));
    const maxEmissions = Math.max(...comparison.map(i => i.emissions_gco2));
    const minEmissions = Math.min(...comparison.map(i => i.emissions_gco2));

    const ranked = comparison.map(item => {
      // Normalization (lower is better, so score = 1 - normalized)
      const normTime = maxTime === minTime ? 1.0 : 1 - ((item.travel_time_min - minTime) / (maxTime - minTime));
      const normCost = maxCost === minCost ? 1.0 : 1 - ((item.cost_inr - minCost) / (maxCost - minCost));
      const normEmissions = maxEmissions === minEmissions ? 1.0 : 1 - ((item.emissions_gco2 - minEmissions) / (maxEmissions - minEmissions));

      // Weighted score
      const score = (wt * normTime) + (wc * normCost) + (we * normEmissions);

      return {
        ...item,
        score: parseFloat(score.toFixed(4)),
        norm_time: normTime,
        norm_cost: normCost,
        norm_emissions: normEmissions,
        recommendation_tag: ''
      };
    });

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    // Identify category selections
    let lowestEmissionsMode = comparison.reduce((prev, curr) => prev.emissions_gco2 < curr.emissions_gco2 ? prev : curr).mode;
    let lowestCostMode = comparison.reduce((prev, curr) => prev.cost_inr < curr.cost_inr ? prev : curr).mode;
    let lowestTimeMode = comparison.reduce((prev, curr) => prev.travel_time_min < curr.travel_time_min ? prev : curr).mode;

    ranked.forEach((item, index) => {
      item.rank = index + 1;
      let tags = [];
      if (item.rank === 1) tags.push('best_overall');
      if (item.mode === lowestEmissionsMode && item.emissions_gco2 < ranked.find(r => r.mode === 'car_petrol')?.emissions_gco2) tags.push('eco_choice');
      if (item.mode === lowestCostMode) tags.push('budget_choice');
      if (item.mode === lowestTimeMode) tags.push('fastest_choice');
      
      // Store primary tag
      item.recommendation_tag = tags[0] || '';
      item.all_tags = tags;
    });

    return ranked;
  }

  getEcoInsights(rankedList) {
    if (rankedList.length === 0) return null;

    const bestOverall = rankedList[0];
    const ecoChoice = rankedList.find(r => r.all_tags.includes('eco_choice')) || bestOverall;
    const budgetChoice = rankedList.find(r => r.all_tags.includes('budget_choice')) || bestOverall;
    const fastestChoice = rankedList.find(r => r.all_tags.includes('fastest_choice')) || bestOverall;

    const carPetrol = rankedList.find(r => r.mode === 'car_petrol');
    const potentialSavings = carPetrol ? (carPetrol.emissions_gco2 - bestOverall.emissions_gco2) : 0;

    return {
      best_overall: bestOverall.mode,
      eco_choice: ecoChoice.mode,
      budget_choice: budgetChoice.mode,
      fastest_choice: fastestChoice.mode,
      potential_co2_savings_vs_car: parseFloat(Math.max(0, potentialSavings).toFixed(2))
    };
  }
}

// ==========================================
// 4. TRAFFIC & CONGESTION PREDICTOR
// ==========================================
class TrafficPredictor {
  predictCongestion(hour, dayOfWeek, weatherCode = 0) {
    // Math regression simulating peak hours, weather, and day variations
    let factor = 1.0;

    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Sat or Sun
    const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);

    if (isPeakHour && !isWeekend) {
      factor += 0.6; // Rush hour multiplier
    } else if (isPeakHour && isWeekend) {
      factor += 0.25; // Weekend peak hour
    }

    if (isWeekend) {
      factor -= 0.15; // Weekend general reduction
    }

    // Weather impact (0 = Clear, 1 = Cloudy, 2 = Rain, 3 = Heavy Rain)
    if (weatherCode === 1) {
      factor += 0.05;
    } else if (weatherCode === 2) {
      factor += 0.25;
    } else if (weatherCode === 3) {
      factor += 0.50;
    }

    // Add deterministic pseudo-noise based on inputs to look authentic
    const pseudoNoise = Math.sin(hour * 0.5) * 0.08;
    factor += pseudoNoise;

    // Clamp between 0.8 and 2.0
    return Math.max(0.8, Math.min(2.0, parseFloat(factor.toFixed(2))));
  }

  getCongestionLabel(factor) {
    if (factor < 1.1) return 'Low 🟢';
    if (factor < 1.3) return 'Moderate 🟡';
    if (factor < 1.6) return 'High 🟠';
    return 'Severe 🔴';
  }

  getHourlyForecast(dayOfWeek = 0, weatherCode = 0) {
    const forecast = [];
    for (let h = 0; h < 24; h++) {
      const factor = this.predictCongestion(h, dayOfWeek, weatherCode);
      forecast.push({
        hour: h,
        congestion_factor: factor,
        congestion_label: this.getCongestionLabel(factor)
      });
    }
    return forecast;
  }
}

// ==========================================
// 5. ECO-COACH AI (Rule-Based Fallback Engine)
// ==========================================
class EcoCoach {
  constructor() {
    this.tips = [
      "Switching from private petrol vehicles to public transport like the metro or electric trains can reduce your personal commute carbon emissions by over 80%.",
      "Carpooling with just one other person splits your fuel expenses and commute carbon footprint by exactly 50%.",
      "For commutes under 5 km, cycling is often faster than driving through dense traffic, improves your cardiovascular fitness, and emits zero greenhouse gases.",
      "Keeping your tires properly inflated can improve your vehicle's fuel mileage by up to 3%, cutting emissions and costs.",
      "Electric vehicles in India emit roughly 50g CO₂/km (taking the local coal grid mix into account) compared to 170g CO₂/km for petrol vehicles.",
      "Active commuting (walking and cycling) helps prevent chronic illnesses and reduces your annual carbon output by up to 0.5 tonnes.",
      "Avoid idling in traffic. If your vehicle is stopped for more than 10 seconds, switching off the engine saves fuel and eliminates local air pollution.",
      "Shared mobility (like public buses) is the backbone of sustainable smart cities, supporting SDG Target 11.2 to build accessible urban transit.",
      "E-scooters are an excellent micro-mobility choice for last-mile connectivity from metro and train stations, emitting only 15g CO₂/km.",
      "Planning your routes and avoiding peak traffic hours reduces time spent idling in congestion, saving both fuel and time.",
      "CNG (Compressed Natural Gas) vehicles emit about 35% less carbon than petrol cars and are significantly cheaper to fuel.",
      "One mature tree absorbs around 21 kg (21,000 grams) of carbon dioxide per year. Choosing public transit for just one 15 km trip saves enough carbon to equal a tree's work for 5 days!",
      "Walking is the most sustainable mode of transport. Walking 1.5 km daily instead of driving avoids 90 kg of CO₂ emissions annually.",
      "Telecommuting or hybrid working even one day a week can reduce your monthly commuting costs and emissions by 20%.",
      "Supporting and voting for dedicated cycling lanes and pedestrian pathways helps city planners advance Smart City sustainability targets."
    ];
  }

  getEcoTipOfTheDay() {
    const today = new Date().getDate();
    return this.tips[today % this.tips.length];
  }

  calculateImpactEquivalence(co2SavedGrams) {
    const treesPerYear = co2SavedGrams / 21000;
    const kmNotDriven = co2SavedGrams / 170; // 170g/km petrol car baseline
    const smartphoneCharges = co2SavedGrams / 8.22; // 8.22g CO2 per charge
    const ledBulbHours = co2SavedGrams / 6.0; // 6g CO2 per hour of 9W LED bulb

    return {
      trees_equivalent: parseFloat(treesPerYear.toFixed(4)),
      km_not_driven: parseFloat(kmNotDriven.toFixed(2)),
      smartphone_charges: Math.round(smartphoneCharges),
      led_bulb_hours: Math.round(ledBulbHours)
    };
  }

  generateAdvice(userQuery, commuteData = null) {
    const q = userQuery.toLowerCase();
    
    // Custom responses based on keywords matching the required 8 topics + default
    if (q.includes('carbon') || q.includes('emission') || q.includes('co2')) {
      return "🌿 **Carbon Emissions Advisory**:\n\nTransportation is a leading driver of urban greenhouse gas emissions. A petrol hatchback emits approximately 170g CO₂/km, while public rail modes (metro, local train) emit only 20-25g CO₂/km. By opting for shared transit (bus/metro) or electric vehicles, you can instantly cut your commute emissions by 70-100%. Active transit like cycling and walking yields absolute zero operational carbon footprint.";
    }
    if (q.includes('save') || q.includes('cost') || q.includes('budget') || q.includes('rupee') || q.includes('inr')) {
      return "💰 **Eco-Financial Advisory**:\n\nSustainable transit is highly cost-effective. While driving a petrol car costs approximately ₹8.5 per km, riding a public bus costs only ₹1.5 per km, and the metro costs ₹3.0 per km. Active modes like walking and bicycling are virtually free. Over a month, shifting a 15 km daily commute from a private car to public metro rail saves over ₹4,000 in fuel and vehicle wear-and-tear.";
    }
    if (q.includes('cycle') || q.includes('bicycle') || q.includes('bike')) {
      return "🚲 **Bicycling Benefits**:\n\nCycling is a cornerstone of sustainable smart cities (SDG 11). It offsets all transport emissions, saves 100% of fuel costs, and improves cardiovascular health. For trips between 1 to 5 km, cycling is often faster than cars in congested Indian city centers. A standard 3 km bicycle ride burns roughly 100-150 calories and avoids 510g of carbon emissions compared to driving a petrol car.";
    }
    if (q.includes('bus') || q.includes('metro') || q.includes('transit') || q.includes('train')) {
      return "🚇 **Public Transit Guidance**:\n\nModern transit networks are designed to carry massive passenger volumes with minimal spatial and carbon footprints. Metro trains run on electric tracks (highly efficient and pollution-free at source), and public buses emit very low per-capita carbon when passenger loads are high. Combining metro rails for long-distance commutes with walking/cycling for last-mile connectivity is the most sustainable urban commuting strategy.";
    }
    if (q.includes('carpool') || q.includes('share') || q.includes('ride')) {
      return "👥 **Carpool Optimization**:\n\nIf active or public transport is not a viable option for your route, carpooling is the next best choice. Sharing a ride with a colleague or neighbor immediately divides the emissions and costs of that trip. A 2-person carpool cuts emissions to 85g CO₂/km per passenger (a 50% savings), and a 4-person carpool drops it to just 43g CO₂/km—making it cleaner than driving an electric vehicle!";
    }
    if (q.includes('health') || q.includes('active') || q.includes('walk')) {
      return "🏃 **Active Commuting & Health**:\n\nIntegrating active mobility (walking, cycling) into your daily routine is highly beneficial. Just 30 minutes of active commuting per day reduces the risk of cardiovascular disease by 20% and burns around 150 calories. It is an excellent way to achieve daily fitness goals while combatting local air pollution. Walking is also completely noise-free and produces zero emissions.";
    }
    if (q.includes('electric') || q.includes('ev') || q.includes('scooter')) {
      return "⚡ **Electric Vehicles & Micro-mobility**:\n\nElectric vehicles (EVs) have zero tailpipe emissions, significantly reducing urban smog. While recharging from India's electricity grid (which relies heavily on coal) incurs an indirect footprint of ~50g CO₂/km, this is still 70% cleaner than petrol engines. E-scooters and electric bikes are highly efficient micro-mobility solutions for short trips or transit connections, emitting only 15g CO₂/km.";
    }
    if (q.includes('tip') || q.includes('guide') || q.includes('how') || q.includes('advice')) {
      return "💡 **General Commute Optimization Tips**:\n\n1. **Check Congestion**: Avoid driving during peak periods. Road congestion increases engine idling, boosting fuel burn and emissions.\n2. **Combine Trips**: Chain multiple errands into one loop rather than making separate trips from home.\n3. **Maintain Vehicles**: Regularly check tire pressure and engine health. Poorly maintained cars burn up to 10% more fuel.\n4. **Public First**: Commit to taking public transit at least 2 days a week to build a green habit.";
    }

    // Default response if no keywords match
    let defaultResponse = "🌿 **Welcome to EcoRoute AI Eco-Coach!**\n\nI am your sustainability transport advisor. I can help you analyze your travel choices and find ways to cut down on emissions and expenses. \n\nTry asking me questions like:\n- *How can I reduce my carbon footprint?*\n- *What are the cost savings of cycling vs driving?*\n- *Is public metro transit cleaner than an electric vehicle?*\n- *How do carpools help the environment?*\n- *Give me tips on active commuting.*";
    
    if (commuteData) {
      defaultResponse += `\n\n**Analysis of your last planned route (${commuteData.distance_km} km):**\n` + 
      `• Choosing a **metro** would emit only **${Math.round(20 * commuteData.distance_km)}g CO₂**, compared to **${Math.round(170 * commuteData.distance_km)}g CO₂** in a petrol car.\n` + 
      `• This single change would save **${Math.round(150 * commuteData.distance_km)}g CO₂** — equivalent to charging a smartphone **${Math.round((150 * commuteData.distance_km)/8.22)} times**!`;
    }
    
    return defaultResponse;
  }
}

// ==========================================
// 6. APPLICATION CONTROLLER (SPA Logic)
// ==========================================
class AppController {
  constructor() {
    this.db = new DatabaseManager();
    this.calculator = new EmissionCalculator();
    this.recommender = new RouteRecommender(this.calculator);
    this.predictor = new TrafficPredictor();
    this.coach = new EcoCoach();

    this.charts = {};
    this.chatHistory = [];
    this.lastCalculation = null;

    this.initElements();
    this.initEvents();
    this.loadState();
  }

  initElements() {
    // Navigation items
    this.navItems = document.querySelectorAll('.nav-item');
    this.pageViews = document.querySelectorAll('.page-view');

    // Planner Inputs
    this.originInput = document.getElementById('origin');
    this.destInput = document.getElementById('destination');
    this.distanceSlider = document.getElementById('distance');
    this.distanceVal = document.getElementById('distance-val');
    this.hourSlider = document.getElementById('hour');
    this.hourVal = document.getElementById('hour-val');
    this.daySelect = document.getElementById('day-of-week');
    this.weatherSelect = document.getElementById('weather');

    // Priority Sliders
    this.timeWeightSlider = document.getElementById('weight-time');
    this.timeWeightVal = document.getElementById('weight-time-val');
    this.costWeightSlider = document.getElementById('weight-cost');
    this.costWeightVal = document.getElementById('weight-cost-val');
    this.ecoWeightSlider = document.getElementById('weight-eco');
    this.ecoWeightVal = document.getElementById('weight-eco-val');

    // Modes select container
    this.modeCheckboxContainer = document.getElementById('mode-checkbox-container');

    // Planner Result Container
    this.resultsCard = document.getElementById('results-card');
    this.calcBtn = document.getElementById('btn-calculate');

    // Chat items
    this.chatHistoryContainer = document.getElementById('chat-history');
    this.chatInput = document.getElementById('chat-input');
    this.sendChatBtn = document.getElementById('btn-send-chat');

    // Settings Profile Forms
    this.userSelect = document.getElementById('user-profile-select');
    this.newUserName = document.getElementById('new-user-name');
    this.newUserCity = document.getElementById('new-user-city');
    this.newUserPref = document.getElementById('new-user-pref');
    this.btnSaveUser = document.getElementById('btn-save-user');
    
    // SDG Badge tooltip or text tip of day
    this.sidebarTip = document.getElementById('sidebar-tip-of-day');
  }

  initEvents() {
    // Page switching
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Slider value sync
    this.distanceSlider.addEventListener('input', (e) => {
      this.distanceVal.textContent = e.target.value + ' km';
    });

    this.hourSlider.addEventListener('input', (e) => {
      const h = parseInt(e.target.value);
      const ampm = h >= 12 ? (h === 12 ? '12 PM' : (h - 12) + ' PM') : (h === 0 ? '12 AM' : h + ' AM');
      this.hourVal.textContent = ampm;
    });

    // Auto-normalize sliders
    const weights = [this.timeWeightSlider, this.costWeightSlider, this.ecoWeightSlider];
    weights.forEach(slider => {
      slider.addEventListener('input', (e) => {
        this.normalizeWeights(e.target.id, parseInt(e.target.value));
      });
    });

    // Calculate action
    this.calcBtn.addEventListener('click', () => this.handleCalculation());

    // Send chat message
    this.sendChatBtn.addEventListener('click', () => this.handleChatInput());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleChatInput();
    });

    // Interactive suggestion buttons
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.textContent;
        this.addChatMessage(text, 'user');
        this.respondToChat(text);
      });
    });

    // User Profile settings actions
    this.userSelect.addEventListener('change', (e) => {
      const uId = parseInt(e.target.value);
      this.db.setCurrentUser(uId);
      this.loadCurrentUserProfile();
      this.showToast('User profile switched!', 'success');
    });

    this.btnSaveUser.addEventListener('click', () => {
      const name = this.newUserName.value.trim();
      const city = this.newUserCity.value.trim();
      const pref = this.newUserPref.value;
      if (!name || !city) {
        this.showToast('Please fill in name and city.', 'warning');
        return;
      }
      const newId = this.db.addUser(name, city, pref, 0.33, 0.33, 0.34);
      this.db.setCurrentUser(newId);
      this.loadUsersDropdown();
      this.loadCurrentUserProfile();
      this.newUserName.value = '';
      this.newUserCity.value = '';
      this.showToast('New user profile created and selected!', 'success');
    });

    // Settings db clear
    document.getElementById('btn-clear-db')?.addEventListener('click', () => {
      if (confirm("Are you sure you want to clear your commute history? This cannot be undone.")) {
        this.db.clearHistory();
        this.renderHistoryTable();
        this.renderAnalytics();
        this.renderImpact();
        this.showToast('Commute history cleared successfully!', 'success');
      }
    });

    // Accordion expand for Q&A
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const isActive = item.classList.contains('active');
        // close all
        document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });

    // Update distance automatically based on origin and destination inputs
    const updateDistance = () => {
      const origin = this.originInput.value.trim();
      const dest = this.destInput.value.trim();
      if (origin && dest) {
        const calculatedDistance = this.getDistanceForLocations(origin, dest);
        this.distanceSlider.value = calculatedDistance;
        this.distanceVal.textContent = calculatedDistance + ' km';
      }
    };

    this.originInput.addEventListener('input', updateDistance);
    this.destInput.addEventListener('input', updateDistance);
  }

  loadState() {
    // Tip of day sidebar
    this.sidebarTip.textContent = this.coach.getEcoTipOfTheDay();

    // Populate checkboxes for available modes
    this.modeCheckboxContainer.innerHTML = '';
    this.calculator.getAllModes().forEach(mode => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.innerHTML = `<input type="checkbox" value="${mode}" checked> ${this.calculator.getModeDisplayName(mode)}`;
      this.modeCheckboxContainer.appendChild(label);
    });

    // Load users lists
    this.loadUsersDropdown();
    this.loadCurrentUserProfile();

    // Default chat message
    this.addChatMessage(this.coach.generateAdvice(''), 'assistant');

    // Run a default calculation to populate graphs on load
    this.handleCalculation(true);
  }

  switchView(viewName) {
    this.navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.pageViews.forEach(view => {
      if (view.id === `view-${viewName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Refresh pages that require recalculations on load
    if (viewName === 'analytics') {
      this.renderAnalytics();
    } else if (viewName === 'impact') {
      this.renderImpact();
    } else if (viewName === 'settings') {
      this.renderHistoryTable();
    }
  }

  normalizeWeights(changedId, value) {
    // Normalize three sliders to sum to 100
    let wTime = parseInt(this.timeWeightSlider.value);
    let wCost = parseInt(this.costWeightSlider.value);
    let wEco = parseInt(this.ecoWeightSlider.value);

    const diff = 100 - (wTime + wCost + wEco);

    if (changedId === 'weight-time') {
      // Split diff between cost and eco
      const split = diff / 2;
      wCost += Math.floor(split);
      wEco += Math.ceil(split);
    } else if (changedId === 'weight-cost') {
      const split = diff / 2;
      wTime += Math.floor(split);
      wEco += Math.ceil(split);
    } else {
      const split = diff / 2;
      wTime += Math.floor(split);
      wCost += Math.ceil(split);
    }

    // Safeguard bounds (0-100)
    wTime = Math.max(0, Math.min(100, wTime));
    wCost = Math.max(0, Math.min(100, wCost));
    wEco = Math.max(0, Math.min(100, wEco));

    // Fix remainder diff
    const finalDiff = 100 - (wTime + wCost + wEco);
    if (finalDiff !== 0) {
      if (changedId !== 'weight-eco') wEco += finalDiff;
      else wCost += finalDiff;
    }

    // Set values
    this.timeWeightSlider.value = wTime;
    this.timeWeightVal.textContent = wTime + '%';
    this.costWeightSlider.value = wCost;
    this.costWeightVal.textContent = wCost + '%';
    this.ecoWeightSlider.value = wEco;
    this.ecoWeightVal.textContent = wEco + '%';
  }

  loadUsersDropdown() {
    this.userSelect.innerHTML = '';
    const users = this.db.getAllUsers();
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.city})`;
      if (u.id === this.db.getCurrentUserId()) opt.selected = true;
      this.userSelect.appendChild(opt);
    });
  }

  loadCurrentUserProfile() {
    const cur = this.db.getUser(this.db.getCurrentUserId());
    if (cur) {
      // Set sliders in settings view
      document.getElementById('profile-name').textContent = cur.name;
      document.getElementById('profile-city').textContent = cur.city;
      document.getElementById('profile-mode').textContent = this.calculator.getModeDisplayName(cur.preferred_mode);

      // Load user defaults into planner page weights
      const tWt = Math.round(cur.weight_time * 100);
      const cWt = Math.round(cur.weight_cost * 100);
      const eWt = Math.round(cur.weight_emissions * 100);

      this.timeWeightSlider.value = tWt;
      this.timeWeightVal.textContent = tWt + '%';
      this.costWeightSlider.value = cWt;
      this.costWeightVal.textContent = cWt + '%';
      this.ecoWeightSlider.value = eWt;
      this.ecoWeightVal.textContent = eWt + '%';
    }
  }

  getDistanceForLocations(origin, dest) {
    const origNorm = origin.toLowerCase().trim().replace(/\s+/g, '');
    const destNorm = dest.toLowerCase().trim().replace(/\s+/g, '');

    // Database of popular pairs with realistic distances
    const pairs = {
      'indiranagar-electroniccity': 22,
      'electroniccity-indiranagar': 22,
      'indiranagar-marathahalli': 7,
      'marathahalli-indiranagar': 7,
      'electroniccity-majestic': 20,
      'majestic-electroniccity': 20,
      'majestic-koramangala': 10,
      'koramangala-majestic': 10,
      'airport-majestic': 35,
      'majestic-airport': 35,
      'koramangala-indiranagar': 6,
      'indiranagar-koramangala': 6,
      'mgroad-whitefield': 18,
      'whitefield-mgroad': 18,
      'connaughtplace-noida': 25,
      'noida-connaughtplace': 25,
      'gurgaon-delhiairport': 15,
      'delhiairport-gurgaon': 15
    };

    const key = `${origNorm}-${destNorm}`;
    if (pairs[key]) {
      return pairs[key];
    }

    // Deterministic hash fallback (hash string to 3-45 km)
    const str = origNorm + destNorm;
    if (str.length === 0) return 15;
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const min = 3;
    const max = 45;
    return min + (Math.abs(hash) % (max - min + 1));
  }

  getSelectedModes() {
    const checkboxes = this.modeCheckboxContainer.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });
    return selected;
  }

  handleCalculation(isSilent = false) {
    const origin = this.originInput.value.trim() || 'Indiranagar';
    const dest = this.destInput.value.trim() || 'Electronic City';
    const dist = parseFloat(this.distanceSlider.value);
    const hour = parseInt(this.hourSlider.value);
    const day = parseInt(this.daySelect.value);
    
    // Clear=0, Cloudy=1, Rain=2, Heavy Rain=3
    const weatherText = this.weatherSelect.value;
    const weatherMap = { 'clear': 0, 'cloudy': 1, 'rainy': 2, 'heavy_rain': 3 };
    const weatherCode = weatherMap[weatherText] || 0;

    // Weights
    const wt = parseInt(this.timeWeightSlider.value) / 100;
    const wc = parseInt(this.costWeightSlider.value) / 100;
    const we = parseInt(this.ecoWeightSlider.value) / 100;

    const selectedModes = this.getSelectedModes();

    if (selectedModes.length === 0) {
      this.showToast('Please select at least one available transport mode.', 'warning');
      return;
    }

    // 1. Predict Traffic
    const congestionFactor = this.predictor.predictCongestion(hour, day, weatherCode);
    const congestionLabel = this.predictor.getCongestionLabel(congestionFactor);

    // 2. Rank Routes
    const ranked = this.recommender.rankRoutes(dist, wt, wc, we, congestionFactor, selectedModes);
    if (ranked.length === 0) return;

    // Save for Logging references
    const topRecommendation = ranked[0];
    this.lastCalculation = {
      origin,
      destination,
      distance_km: dist,
      mode: topRecommendation.mode,
      travel_time_min: topRecommendation.travel_time_min,
      cost_inr: topRecommendation.cost_inr,
      emissions_gco2: topRecommendation.emissions_gco2
    };

    if (isSilent) return; // don't render UI changes if this was an initial mock run

    // Render results UI
    this.resultsCard.classList.remove('hide');

    // Congestion Display
    const congElement = document.getElementById('congestion-display');
    congElement.className = 'congestion-badge';
    if (congestionFactor < 1.1) congElement.classList.add('congestion-low');
    else if (congestionFactor < 1.6) congElement.classList.add('congestion-moderate');
    else congElement.classList.add('congestion-high');
    congElement.innerHTML = `Traffic Congestion Factor: ${congestionFactor}x (${congestionLabel})`;

    // Hero top recommendation
    document.getElementById('rec-title').textContent = this.calculator.getModeDisplayName(topRecommendation.mode);
    document.getElementById('rec-time').textContent = Math.round(topRecommendation.travel_time_min) + ' min';
    document.getElementById('rec-cost').textContent = '₹' + Math.round(topRecommendation.cost_inr);
    document.getElementById('rec-emissions').textContent = Math.round(topRecommendation.emissions_gco2) + ' g CO₂';
    document.getElementById('rec-score-val').textContent = topRecommendation.score;

    // Insights Cards
    const insights = this.recommender.getEcoInsights(ranked);
    
    // Eco Choice
    const ecoItem = ranked.find(r => r.mode === insights.eco_choice) || topRecommendation;
    document.getElementById('insight-eco-mode').textContent = this.calculator.getModeDisplayName(ecoItem.mode);
    document.getElementById('insight-eco-val').textContent = Math.round(ecoItem.emissions_gco2) + ' g';
    
    // Budget Choice
    const budgetItem = ranked.find(r => r.mode === insights.budget_choice) || topRecommendation;
    document.getElementById('insight-budget-mode').textContent = this.calculator.getModeDisplayName(budgetItem.mode);
    document.getElementById('insight-budget-val').textContent = '₹' + Math.round(budgetItem.cost_inr);

    // Fastest Choice
    const fastestItem = ranked.find(r => r.mode === insights.fastest_choice) || topRecommendation;
    document.getElementById('insight-fastest-mode').textContent = this.calculator.getModeDisplayName(fastestItem.mode);
    document.getElementById('insight-fastest-val').textContent = Math.round(fastestItem.travel_time_min) + ' min';

    // Total savings statement
    document.getElementById('savings-statement').innerHTML = `💡 Recommending this route saves up to <strong>${Math.round(insights.potential_co2_savings_vs_car)} g CO₂</strong> compared to driving alone in a petrol car.`;

    // Comparison Table
    const tbody = document.getElementById('table-ranked-body');
    tbody.innerHTML = '';
    ranked.forEach(row => {
      const tr = document.createElement('tr');
      
      let tagHtml = '';
      if (row.recommendation_tag) {
        let tagClass = 'tag-best';
        let label = 'Best Overall';
        if (row.recommendation_tag === 'eco_choice') { tagClass = 'tag-eco'; label = 'Eco Choice'; }
        else if (row.recommendation_tag === 'budget_choice') { tagClass = 'tag-budget'; label = 'Cheapest'; }
        else if (row.recommendation_tag === 'fastest_choice') { tagClass = 'tag-fastest'; label = 'Fastest'; }
        
        tagHtml = `<span class="tag-pill ${tagClass}">${label}</span>`;
      }

      tr.innerHTML = `
        <td><strong>${row.rank}</strong></td>
        <td>${this.calculator.getModeDisplayName(row.mode)}</td>
        <td>${Math.round(row.travel_time_min)} min</td>
        <td>₹${Math.round(row.cost_inr)}</td>
        <td>${Math.round(row.emissions_gco2)} g</td>
        <td><strong>${row.score}</strong></td>
        <td>${tagHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    // Save Log button
    const btnSave = document.getElementById('btn-save-commute');
    btnSave.disabled = false;
    btnSave.innerHTML = `<i class="fas fa-bookmark"></i> Save This Commute`;
    btnSave.onclick = () => this.handleSaveCommute();

    // Render comparison chart
    this.renderPlannerChart(ranked);

    // Scroll to results
    this.resultsCard.scrollIntoView({ behavior: 'auto' });
  }

  handleSaveCommute() {
    if (!this.lastCalculation) return;

    const uId = this.db.getCurrentUserId();
    const l = this.lastCalculation;
    this.db.logCommute(uId, l.origin, l.destination, l.distance_km, l.mode, l.travel_time_min, l.cost_inr, l.emissions_gco2);
    
    const btnSave = document.getElementById('btn-save-commute');
    btnSave.disabled = true;
    btnSave.innerHTML = `<i class="fas fa-check"></i> Commute Saved!`;
    this.showToast('Commute logged to history successfully!', 'success');
  }

  handleChatInput() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.addChatMessage(text, 'user');
    this.chatInput.value = '';

    setTimeout(() => {
      this.respondToChat(text);
    }, 50);
  }

  addChatMessage(content, sender) {
    const msg = document.createElement('div');
    msg.className = `chat-message message-${sender}`;
    
    const avatar = sender === 'user' ? '👤' : '🌿';
    msg.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
    `;
    this.chatHistoryContainer.appendChild(msg);
    this.chatHistoryContainer.scrollTop = this.chatHistoryContainer.scrollHeight;
  }

  respondToChat(query) {
    let commuteContext = null;
    if (this.lastCalculation) {
      commuteContext = this.lastCalculation;
    }
    const reply = this.coach.generateAdvice(query, commuteContext);
    this.addChatMessage(reply, 'assistant');
  }

  // ==========================================
  // CHART RENDERING (Chart.js Integration)
  // ==========================================
  renderPlannerChart(rankedList) {
    const ctx = document.getElementById('chart-planner-comparison');
    if (!ctx) return;

    // Destroy old chart
    if (this.charts.planner) {
      this.charts.planner.destroy();
    }

    const labels = rankedList.map(r => this.calculator.getModeDisplayName(r.mode).split(' ')[1] || r.mode);
    const emissions = rankedList.map(r => r.emissions_gco2);
    const costs = rankedList.map(r => r.cost_inr);
    const times = rankedList.map(r => r.travel_time_min);

    // Make sure Chart.js is loaded
    if (typeof Chart === 'undefined') {
      ctx.parentElement.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding-top: 50px;">Chart.js could not be loaded offline. Displaying comparative table above instead.</div>';
      return;
    }

    this.charts.planner = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Emissions (gCO₂)',
            data: emissions,
            backgroundColor: '#00d4aa',
            borderWidth: 0,
            borderRadius: 4
          },
          {
            label: 'Cost (₹)',
            data: costs,
            backgroundColor: '#f59e0b',
            borderWidth: 0,
            borderRadius: 4
          },
          {
            label: 'Travel Time (min)',
            data: times,
            backgroundColor: '#3b82f6',
            borderWidth: 0,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter' } }
          }
        },
        scales: {
          x: {
            ticks: { color: '#64748b' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            ticks: { color: '#64748b' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  renderAnalytics() {
    const history = this.db.getCommuteHistory();
    const stats = this.db.getTotalSavings();

    const infoBox = document.getElementById('analytics-no-data-alert');
    const container = document.getElementById('analytics-visual-container');

    if (history.length === 0) {
      infoBox.classList.remove('hide');
      container.classList.add('hide');
      return;
    }

    infoBox.classList.add('hide');
    container.classList.remove('hide');

    // Metrics Row
    document.getElementById('stat-total-commutes').textContent = stats.total_commutes;
    document.getElementById('stat-total-distance').textContent = stats.total_distance_km + ' km';
    document.getElementById('stat-total-emissions').textContent = Math.round(stats.total_emissions_gco2) + ' g';
    document.getElementById('stat-total-savings').textContent = Math.round(stats.co2_saved_gco2) + ' g';

    // Chart.js safety
    if (typeof Chart === 'undefined') return;

    // Tab Switch inside Analytics
    const tabBtns = container.querySelectorAll('.tab-btn');
    const tabPanels = container.querySelectorAll('.tab-panel');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        document.getElementById(`tab-${target}`).classList.add('active');
        this.renderSpecificAnalyticsTab(target, history);
      };
    });

    // Default trigger first tab
    this.renderSpecificAnalyticsTab('modes', history);
  }

  renderSpecificAnalyticsTab(tab, history) {
    if (tab === 'modes') {
      // Group by modes
      const groups = {};
      history.forEach(h => {
        groups[h.mode] = (groups[h.mode] || 0) + 1;
      });

      const labels = Object.keys(groups).map(m => this.calculator.getModeDisplayName(m).split(' ')[1] || m);
      const data = Object.values(groups);

      const ctx = document.getElementById('chart-analytics-modes');
      if (this.charts.modesPie) this.charts.modesPie.destroy();
      this.charts.modesPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: ['#00d4aa', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'],
            borderWidth: 1,
            borderColor: 'rgba(10, 15, 28, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#94a3b8' }
            }
          }
        }
      });
    }

    if (tab === 'trends') {
      // Group emissions by date
      const dates = {};
      const datesSaved = {};
      history.forEach(h => {
        dates[h.date] = (dates[h.date] || 0) + h.emissions_gco2;
        // baseline car saved
        datesSaved[h.date] = (datesSaved[h.date] || 0) + ((170 * h.distance_km) - h.emissions_gco2);
      });

      const labels = Object.keys(dates).sort();
      const emitted = labels.map(d => dates[d]);
      const saved = labels.map(d => datesSaved[d]);

      const ctx = document.getElementById('chart-analytics-trends');
      if (this.charts.trendsLine) this.charts.trendsLine.destroy();
      this.charts.trendsLine = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Emissions (gCO₂)',
              data: emitted,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: true,
              tension: 0.2
            },
            {
              label: 'CO₂ Saved (g)',
              data: saved,
              borderColor: '#00d4aa',
              backgroundColor: 'rgba(0, 212, 170, 0.1)',
              fill: true,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    if (tab === 'forecast') {
      // Render hourly congestion line chart
      const day = parseInt(document.getElementById('forecast-day').value || '0');
      const weather = parseInt(document.getElementById('forecast-weather').value || '0');

      const data = this.predictor.getHourlyForecast(day, weather);
      const labels = data.map(d => {
        const h = d.hour;
        return h >= 12 ? (h === 12 ? '12 PM' : (h - 12) + ' PM') : (h === 0 ? '12 AM' : h + ' AM');
      });
      const factors = data.map(d => d.congestion_factor);

      const ctx = document.getElementById('chart-analytics-forecast');
      if (this.charts.forecastLine) this.charts.forecastLine.destroy();

      // Trigger redraw when selection shifts
      document.getElementById('forecast-day').onchange = () => this.renderSpecificAnalyticsTab('forecast', history);
      document.getElementById('forecast-weather').onchange = () => this.renderSpecificAnalyticsTab('forecast', history);

      this.charts.forecastLine = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Predicted Traffic Multiplier',
            data: factors,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { min: 0.5, max: 2.2, ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }
  }

  renderImpact() {
    const stats = this.db.getTotalSavings();
    const co2SavedKg = stats.co2_saved_gco2 / 1000;

    // CO₂ Savings metric
    document.getElementById('impact-co2-hero').textContent = co2SavedKg.toFixed(2) + ' kg';

    // Equivalence calculations
    const equiv = this.coach.calculateImpactEquivalence(stats.co2_saved_gco2);
    document.getElementById('impact-trees').textContent = equiv.trees_equivalent.toFixed(4) + ' trees';
    document.getElementById('impact-car-km').textContent = equiv.km_not_driven.toFixed(1) + ' km';
    document.getElementById('impact-phones').textContent = equiv.smartphone_charges.toLocaleString();
    document.getElementById('impact-led').textContent = equiv.led_bulb_hours.toLocaleString() + ' hrs';

    // Goal Progress (Goal = 100 kg CO2 saved)
    const goal = 100; // in kg
    const percentage = Math.min(100, Math.max(0, (co2SavedKg / goal) * 100));
    document.getElementById('impact-progress-fill').style.width = percentage + '%';
    document.getElementById('impact-progress-text').innerHTML = `Goal Progress: <strong>${co2SavedKg.toFixed(2)} / ${goal} kg</strong> (${Math.round(percentage)}% Completed)`;
  }

  renderHistoryTable() {
    const history = this.db.getCommuteHistory();
    const tbody = document.getElementById('settings-history-body');
    const tableDiv = document.getElementById('settings-history-container');
    const noDataAlert = document.getElementById('settings-no-data-alert');

    if (history.length === 0) {
      tableDiv.classList.add('hide');
      noDataAlert.classList.remove('hide');
      return;
    }

    tableDiv.classList.remove('hide');
    noDataAlert.classList.add('hide');
    tbody.innerHTML = '';

    // Load recent history (max 20 entries)
    history.slice().reverse().forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.origin} ➔ ${row.destination}</td>
        <td>${row.distance_km} km</td>
        <td>${this.calculator.getModeDisplayName(row.mode)}</td>
        <td>₹${Math.round(row.cost_inr)}</td>
        <td>${Math.round(row.emissions_gco2)} g</td>
      `;
      tbody.appendChild(tr);
    });

    // Populate database stats
    document.getElementById('db-stat-size').textContent = history.length + ' logs';
    document.getElementById('db-stat-users').textContent = this.db.getAllUsers().length + ' profiles';
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(message, type = 'info') {
    // Basic toast overlay
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.minWidth = '250px';
    toast.style.animation = 'fadeIn 0.2s ease-out';
    
    const icon = type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.2s ease-out forwards';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }
}

// Instantiate App on Page Load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
