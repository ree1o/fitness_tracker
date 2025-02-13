document.addEventListener("DOMContentLoaded", function () {
    let mealsLoaded = false;
    let workoutsLoaded = false;

    function updateNav() {
        const token = localStorage.getItem("token");
        const navLinks = document.querySelector(".nav-links");

        if (navLinks) {
            if (token) {
                navLinks.innerHTML = `
                    <li><a href="index.html">Home</a></li>
                    <li><a href="workouts.html">Workouts</a></li>
                    <li><a href="meals.html">Meals</a></li>
                    <li><a href="dashboard.html">Dashboard</a></li>
                    <li><a href="profile.html">Profile</a></li>
                    <li><a href="#" id="logout-btn">Logout</a></li>
                `;
                document.querySelector("#logout-btn").addEventListener("click", logout);
            } else {
                navLinks.innerHTML = `
                    <li><a href="index.html">Home</a></li>
                    <li><a href="workouts.html">Workouts</a></li>
                    <li><a href="meals.html">Meals</a></li>
                    <li><a href="dashboard.html">Dashboard</a></li>
                    <li><a href="login.html">Login</a></li>
                `;
            }
        }
    }

    function logout() {
        console.log("Logging out... ✅");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        window.location.href = "login.html";
    }

    async function calculateBMI(event) {
        event.preventDefault();

        const weight = parseFloat(document.getElementById("bmi-weight")?.value);
        const height = parseFloat(document.getElementById("bmi-height")?.value);
        const bmiResult = document.getElementById("bmi-result");
        const bmiValue = document.getElementById("bmi-value");
        const bmiCategory = document.getElementById("bmi-category");
        const email = localStorage.getItem("userEmail");
        const token = localStorage.getItem("token");

        if (!token) {
            alert("Please log in first.");
            return;
        }

        if (isNaN(weight) || isNaN(height) || weight <= 0 || height <= 0) {
            alert("Please enter valid weight and height values.");
            return;
        }

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ weight, height, email })
            });

            if (!response.ok) throw new Error("Failed to calculate BMI");

            const data = await response.json();
            bmiValue.textContent = `BMI: ${data.bmi}`;
            bmiCategory.textContent = `Category: ${data.category}`;
            bmiResult.style.display = "block";
        } catch (error) {
            console.error("Error calculating BMI:", error);
            alert("Error calculating BMI. Please try again.");
        }
    }

    async function handleLogin(event) {
        event.preventDefault();

        const email = document.querySelector("#email").value.trim();
        const password = document.querySelector("#password").value.trim();

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.message || "Login failed");

            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.user.id);
            localStorage.setItem("userEmail", email);
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Login error:", error);
            alert("Failed to log in. Please try again.");
        }
    }

    async function loadProfile() {
        const token = localStorage.getItem("token");

        if (!token) {
            alert("Session expired. Please log in again.");
            window.location.href = "login.html";
            return;
        }

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch profile");

            const user = await response.json();
            document.getElementById("user-name").textContent = user.name;
            document.getElementById("user-email").textContent = user.email;
            document.getElementById("user-age").textContent = user.age;
            document.getElementById("user-weight").textContent = user.weight;
            document.getElementById("user-height").textContent = user.height;
        } catch (error) {
            console.error("Profile load error:", error);
            alert("Session expired. Please log in again.");
            localStorage.removeItem("token");
            window.location.href = "login.html";
        }
    }

    async function calculateCaloriesFromAPI(activity, duration, weight, height, age) {
        const API_URL = "https://trackapi.nutritionix.com/v2/natural/exercise";
        const API_KEY = "06d9e55b285a95d845d33e6f7ddc3009"; 
        const API_ID = "70a8ae3e";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-app-id": API_ID,
                    "x-app-key": API_KEY
                },
                body: JSON.stringify({
                    query: `${activity} ${duration} min`,
                    weight_kg: weight,
                    height_cm: height,
                    age: age
                })
            });

            const data = await response.json();
            if (data.exercises.length > 0) {
                return data.exercises[0].nf_calories;
            }
            return 0;
        } catch (error) {
            console.error("❌ API Error:", error);
            return 0;
        }
    }

    async function addWorkout(event) {
        event.preventDefault();

        const workoutName = document.querySelector("#workout-name").value.trim();
        const duration = document.querySelector("#workout-duration").value.trim();
        const token = localStorage.getItem("token");

        if (!workoutName || !duration) {
            alert("Please fill out all fields.");
            return;
        }

        const userResponse = await fetch("https://fitness-tracker-b3q1.onrender.com", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!userResponse.ok) {
            alert("Failed to get user data.");
            return;
        }

        const user = await userResponse.json();
        const { weight, height, age } = user;

        const calories = await calculateCaloriesFromAPI(workoutName, duration, weight, height, age);

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ name: workoutName, duration, calories, date: new Date().toISOString().split("T")[0] })
            });

            if (!response.ok) throw new Error("Failed to add workout");

            alert(`Workout added! Calories burned: ${calories.toFixed(2)}`);
            document.querySelector("#workout-form").reset();
            await loadWorkouts();
        } catch (error) {
            console.error("❌ Workout addition error:", error);
            alert("Failed to add workout. Please try again.");
        }
    }

    
    async function loadWorkouts() {
        if (workoutsLoaded) return;
        workoutsLoaded = true;
    
        const token = localStorage.getItem("token");
        if (!token) return;
    
        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });
    
            if (!response.ok) throw new Error("Failed to fetch workouts");
    
            const workouts = await response.json();
            const workoutList = document.querySelector("#workout-list");
    
            if (workoutList) {
                workoutList.innerHTML = "";
                workouts.forEach(workout => {
                    let item = document.createElement("li");
                    item.textContent = `${workout.name} - ${workout.duration} min - ${workout.calories} cal`;
                    workoutList.appendChild(item);
                });
            }
        } catch (error) {
            console.error("Error loading workouts:", error);
        }
    }

    async function addMeal(event) {
        event.preventDefault();

        const mealName = document.querySelector("#meal-name").value.trim();
        const calories = document.querySelector("#meal-calories").value.trim();
        const date = new Date().toISOString().split("T")[0];
        const token = localStorage.getItem("token");

        if (!mealName || !calories) {
            alert("Please fill out all fields.");
            return;
        }

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ meal_name: mealName, calories, date })
            });

            if (!response.ok) throw new Error("Failed to add meal");

            alert("Meal added successfully!");
            document.querySelector("#meal-form").reset();
            mealsLoaded = false;
            await loadMeals();
        } catch (error) {
            console.error("Meal addition error:", error);
            alert("Failed to add meal. Please try again.");
        }
    }

    async function loadMeals() {
        if (mealsLoaded) return;
        mealsLoaded = true;

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch meals");

            const meals = await response.json();
            const mealList = document.querySelector("#meal-list");

            if (mealList) {
                mealList.innerHTML = "";
                meals.forEach(meal => {
                    let item = document.createElement("li");
                    item.textContent = `${meal.meal_name} - ${meal.calories} cal (${meal.date.split("T")[0]})`;
                    mealList.appendChild(item);
                });
            }
        } catch (error) {
            console.error("Error loading meals:", error);
        }
    }

    async function loadDashboardMeals() {
        if (!document.querySelector("#dashboard-meal-list")) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch meals");

            const meals = await response.json();
            const mealList = document.querySelector("#dashboard-meal-list");

            mealList.innerHTML = "";
            meals.forEach(meal => {
                let item = document.createElement("li");
                item.textContent = `${meal.meal_name} - ${meal.calories} cal (${meal.date.split("T")[0]})`;
                mealList.appendChild(item);
            });
        } catch (error) {
            console.error("Error loading dashboard meals:", error);
        }
    }

    async function loadDashboardWorkouts() {
        if (!document.querySelector("#dashboard-workout-list")) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const response = await fetch("https://fitness-tracker-b3q1.onrender.com", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch workouts");

            const workouts = await response.json();
            const workoutList = document.querySelector("#dashboard-workout-list");

            workoutList.innerHTML = "";
            workouts.forEach(workout => {
                let item = document.createElement("li");
                item.textContent = `${workout.name} - ${workout.duration} min - ${workout.calories} cal`;
                workoutList.appendChild(item);
            });
        } catch (error) {
            console.error("Error loading dashboard workouts:", error);
        }
    }

    document.querySelector("#login-form")?.addEventListener("submit", handleLogin);
    document.querySelector("#bmi-form")?.addEventListener("submit", calculateBMI);
    document.querySelector("#meal-form")?.addEventListener("submit", addMeal);
    document.querySelector("#workout-form")?.addEventListener("submit", addWorkout);

    if (document.querySelector("#meal-list")) loadMeals();
    if (document.querySelector("#workout-list")) loadWorkouts();
    updateNav();
    if (document.querySelector("#profile-info")) loadProfile();
    if (document.querySelector("#dashboard-meal-list")) loadDashboardMeals();
    if (document.querySelector("#dashboard-workout-list")) loadDashboardWorkouts();
});
