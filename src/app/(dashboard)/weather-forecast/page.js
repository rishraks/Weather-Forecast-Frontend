'use client';

import React, {useState, useEffect} from 'react';
import {
    Cloud, Sun, CloudRain, Wind, Eye, Droplets, MapPin,
    Sunrise, Sunset, Calendar, Search, Loader2, Navigation,
    Gauge, Zap, Snowflake, Clock, ArrowUp, ArrowDown,
    TrendingUp, TrendingDown
} from 'lucide-react';

const WeatherDashboard = () => {
    const [currentWeather, setCurrentWeather] = useState(null);
    const [hourlyForecast, setHourlyForecast] = useState(null);
    const [city, setCity] = useState('Delhi');
    const [searchInput, setSearchInput] = useState('Delhi');
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [error, setError] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const [, setCoordinates] = useState(null);
    const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const fetchWeatherData = async (cityName) => {
        setLoading(true);
        setError(null);

        try {
            // Use city name for both geocoding and weather data
            const geocodeResponse = await fetch(`${BASE_URL}/forecast/geocode?city=${encodeURIComponent(cityName)}`);
            const currentResponse = await fetch(`${BASE_URL}/forecast/current-weather?city=${encodeURIComponent(cityName)}`);
            const hourlyResponse = await fetch(`${BASE_URL}/forecast/hourly-forecast?city=${encodeURIComponent(cityName)}`);

            let properCityName = cityName;

            if (geocodeResponse && geocodeResponse.ok) {
                const geocodeData = await geocodeResponse.json();
                if (geocodeData && geocodeData.length > 0) {
                    properCityName = geocodeData[0].name || geocodeData[0].local_names?.en || cityName;
                }
            }

            if (!currentResponse.ok) throw new Error('Failed to fetch current weather');
            const currentData = await currentResponse.json();

            if (!hourlyResponse.ok) throw new Error('Failed to fetch hourly forecast');
            const hourlyData = await hourlyResponse.json();

            setCurrentWeather(currentData);
            setHourlyForecast(hourlyData);
            setCity(properCityName);

        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An error occurred while fetching weather data');
            }
        } finally {
            setLoading(false);
            setInitialLoad(false);
            setLocationLoading(false);
        }
    };

    const getCityFromCoordinates = async (lat, lon) => {
        try {
            // Use reverse geocoding to get city name from coordinates
            const response = await fetch(`${BASE_URL}/forecast/reverse-geocode?lat=${lat}&lon=${lon}`);

            if (!response.ok) {
                throw new Error('Failed to get city from location');
            }

            const geocodeData = await response.json();

            if (geocodeData && geocodeData.length > 0) {
                let cityName = null;

                // Strategy 1: Look for administrative divisions (city/district level)
                for (const result of geocodeData) {
                    const featureClass = result.feature_class?.toLowerCase();
                    const featureCode = result.feature_code?.toLowerCase();

                    // Prioritize administrative divisions and populated places
                    if ((featureClass === 'p' && featureCode?.startsWith('ppl')) || // Populated places
                        (featureClass === 'a' && (featureCode === 'adm2' || featureCode === 'adm3')) || // Administrative divisions
                        featureCode === 'pplc' || // Capital
                        featureCode === 'ppla' || // Administrative center
                        featureCode === 'ppla2') { // Second-level administrative center

                        const name = result.name || result.local_names?.en;
                        if (name && !isAreaName(name)) {
                            cityName = name;
                            break;
                        }
                    }
                }

                // Strategy 2: Look for results with higher importance and population
                if (!cityName) {
                    let bestResult = null;
                    let bestScore = 0;

                    for (const result of geocodeData) {
                        const name = result.name || result.local_names?.en;
                        if (!name || isAreaName(name)) continue;

                        // Calculate a score based on importance and population
                        const importance = result.importance || 0;
                        const population = result.population || 0;
                        const score = importance + (population / 1000000); // Normalize population

                        if (score > bestScore) {
                            bestScore = score;
                            bestResult = result;
                        }
                    }

                    if (bestResult) {
                        cityName = bestResult.name || bestResult.local_names?.en;
                    }
                }

                // Strategy 3: Find the most "city-like" name from all results
                if (!cityName) {
                    const cityLikeResults = geocodeData
                        .filter(result => {
                            const name = result.name || result.local_names?.en;
                            return name && !isAreaName(name) && isCityLikeName(name);
                        })
                        .sort((a, b) => (b.importance || 0) - (a.importance || 0));

                    if (cityLikeResults.length > 0) {
                        cityName = cityLikeResults[0].name || cityLikeResults[0].local_names?.en;
                    }
                }

                // Fallback: Use first non-area result
                if (!cityName) {
                    for (const result of geocodeData) {
                        const name = result.name || result.local_names?.en;
                        if (name && !isAreaName(name)) {
                            cityName = name;
                            break;
                        }
                    }
                }

                if (cityName) {
                    setCoordinates({lat, lon});
                    return cityName;
                }
            }

            throw new Error('Could not determine city from your location');
        } catch (err) {
            if (err instanceof Error) {
                setError("Unable to get city from location: " + err.message);
            } else {
                throw err;
            }
        }
    };

// Helper function to detect area/district names
    const isAreaName = (name) => {
        const areaIndicators = [
            'block', 'ward', 'sector', 'phase', 'colony', 'society', 'apartment',
            'complex', 'enclave', 'extension', 'layout', 'nagar', 'vihar',
            'residency', 'heights', 'park', 'garden', 'road', 'street',
            'lane', 'marg', 'cross', 'circle', 'square', 'market'
        ];

        const lowerName = name.toLowerCase();

        // Check if name starts with a number (often area codes)
        if (/^\d/.test(name)) return true;

        // Check for common area indicators
        return areaIndicators.some(indicator =>
            lowerName.includes(indicator) ||
            lowerName.startsWith(indicator) ||
            lowerName.endsWith(indicator)
        );
    };

// Helper function to identify city-like names
    const isCityLikeName = (name) => {
        // City names are usually:
        // - Not too short (avoid abbreviations)
        // - Not containing numbers
        // - Not containing common area suffixes
        return name.length >= 3 &&
            !/\d/.test(name) &&
            !name.toLowerCase().includes('pin') &&
            !name.toLowerCase().includes('zip');
    };


    const getCurrentLocation = () => {
        setLocationLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by this browser");
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const {latitude, longitude} = position.coords;

                    // Convert coordinates to city name first
                    const cityName = await getCityFromCoordinates(latitude, longitude);

                    // Then fetch weather data using the city name
                    await fetchWeatherData(cityName);
                    setSearchInput(cityName);

                } catch (error) {
                    if (error instanceof Error) {
                        setError(error.message);
                    } else {
                        setError('An unknown error occurred');
                    }
                    setLocationLoading(false);
                }
            },
            (error) => {
                let errorMessage = 'Unable to get your location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied by user';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                }
                setError(errorMessage);
                setLocationLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    };

    useEffect(() => {
        fetchWeatherData(city);
    }, []);

    const getWeatherIcon = (iconCode, size = 24) => {
        const iconMap = {
            '01d': <Sun size={size} className="text-yellow-400 drop-shadow-lg"/>,
            '01n': <Sun size={size} className="text-yellow-200 drop-shadow-lg"/>,
            '02d': <Cloud size={size} className="text-gray-300 drop-shadow-lg"/>,
            '02n': <Cloud size={size} className="text-gray-400 drop-shadow-lg"/>,
            '03d': <Cloud size={size} className="text-gray-400 drop-shadow-lg"/>,
            '03n': <Cloud size={size} className="text-gray-500 drop-shadow-lg"/>,
            '04d': <Cloud size={size} className="text-gray-500 drop-shadow-lg"/>,
            '04n': <Cloud size={size} className="text-gray-600 drop-shadow-lg"/>,
            '09d': <CloudRain size={size} className="text-blue-400 drop-shadow-lg"/>,
            '09n': <CloudRain size={size} className="text-blue-500 drop-shadow-lg"/>,
            '10d': <CloudRain size={size} className="text-blue-500 drop-shadow-lg"/>,
            '10n': <CloudRain size={size} className="text-blue-600 drop-shadow-lg"/>,
            '11d': <Zap size={size} className="text-yellow-400 drop-shadow-lg"/>,
            '11n': <Zap size={size} className="text-yellow-300 drop-shadow-lg"/>,
            '13d': <Snowflake size={size} className="text-blue-200 drop-shadow-lg"/>,
            '13n': <Snowflake size={size} className="text-blue-100 drop-shadow-lg"/>,
            '50d': <Wind size={size} className="text-gray-400 drop-shadow-lg"/>,
            '50n': <Wind size={size} className="text-gray-300 drop-shadow-lg"/>,
        };
        return iconMap[iconCode] || <Cloud size={size} className="text-gray-400 drop-shadow-lg"/>;
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatFullDate = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    const getWindDirection = (degrees) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(degrees / 45) % 8;
        return directions[index];
    };
    const handleSearch = () => {
        if (searchInput.trim()) {
            fetchWeatherData(searchInput.trim());
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Group hourly forecast by days for 5-day forecast
    const getDailyForecast = () => {
        if (!hourlyForecast || !hourlyForecast.list || hourlyForecast.list.length === 0) {
            return [];
        }

        const dailyData = {};
        const currentDate = new Date().toDateString();

        hourlyForecast.list.forEach((item) => {
            const date = new Date(item.dt * 1000);
            const dateKey = date.toDateString();

            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: item.dt,
                    temps: [],
                    weather: [],
                    humidity: [],
                    wind: [],
                    pop: [],
                    rain: []
                };
            }

            dailyData[dateKey].temps.push(item.main.temp);
            dailyData[dateKey].weather.push(item.weather[0]);
            dailyData[dateKey].humidity.push(item.main.humidity);
            dailyData[dateKey].wind.push(item.wind.speed);
            dailyData[dateKey].pop.push(item.pop || 0);
            if (item.rain && item.rain['3h']) {
                dailyData[dateKey].rain.push(item.rain['3h']);
            }
        });

        return Object.keys(dailyData).slice(0, 5).map(dateKey => {
            const data = dailyData[dateKey];
            const isToday = dateKey === currentDate;

            // Get the most frequent weather condition
            const weatherCounts = {};
            data.weather.forEach(w => {
                const key = w.icon.slice(0, 2); // Get base icon without day/night
                weatherCounts[key] = (weatherCounts[key] || 0) + 1;
            });
            const mostFrequentWeatherKey = Object.keys(weatherCounts).reduce((a, b) =>
                weatherCounts[a] > weatherCounts[b] ? a : b
            );
            const mostFrequentWeather = data.weather.find(w =>
                w.icon.slice(0, 2) === mostFrequentWeatherKey
            );

            return {
                date: data.date,
                isToday,
                tempMin: Math.round(Math.min(...data.temps)),
                tempMax: Math.round(Math.max(...data.temps)),
                weather: mostFrequentWeather,
                avgHumidity: Math.round(data.humidity.reduce((a, b) => a + b, 0) / data.humidity.length),
                maxWind: Math.max(...data.wind),
                maxPop: Math.max(...data.pop),
                totalRain: data.rain.length > 0 ? data.rain.reduce((a, b) => a + b, 0) : 0
            };
        });
    };

    if (loading && initialLoad) {
        return (
            <div
                className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
                <div
                    className="text-white text-center bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
                    <Loader2 className="animate-spin mx-auto mb-4 text-blue-300" size={64}/>
                    <div className="text-2xl font-light">Loading weather data...</div>
                    <div className="text-sm text-white/70 mt-2">Fetching the latest conditions</div>
                </div>
            </div>
        );
    }

    if (error && !currentWeather) {
        return (
            <div
                className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-pink-900 flex items-center justify-center p-4">
                <div
                    className="text-white text-center max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-3xl font-bold mb-4">Oops!</h2>
                    <p className="mb-6 text-white/80">{error}</p>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Enter city name..."
                                className="flex-1 px-4 py-3 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/90 backdrop-blur-sm"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={!searchInput.trim()}
                                className="px-4 py-3 bg-white text-red-600 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center shadow-lg"
                            >
                                <Search size={20}/>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSearchInput('Delhi');
                                    fetchWeatherData('Delhi');
                                }}
                                className="flex-1 px-6 py-3 bg-white/20 text-white border border-white/30 rounded-xl hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
                            >
                                Try Delhi
                            </button>
                            <button
                                onClick={getCurrentLocation}
                                disabled={locationLoading}
                                className="px-4 py-3 bg-blue-500/80 text-white rounded-xl hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center backdrop-blur-sm"
                            >
                                {locationLoading ? <Loader2 className="animate-spin" size={20}/> : <MapPin size={20}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const dailyForecast = getDailyForecast();

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
                <div
                    className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent mb-6 drop-shadow-2xl">
                        ⛅ WeatherScope Pro
                    </h1>

                    {/* Search Controls */}
                    <div className="flex justify-center gap-3 max-w-lg mx-auto">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Enter city name..."
                                className="w-full px-6 py-4 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/90 backdrop-blur-sm shadow-lg text-lg font-medium"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !searchInput.trim()}
                            className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24}/> : <Search size={24}/>}
                        </button>
                        <button
                            onClick={getCurrentLocation}
                            disabled={locationLoading || loading}
                            className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:scale-105"
                            title="Use current location"
                        >
                            {locationLoading ?
                                <Loader2 className="animate-spin" size={24}/> :
                                <Navigation size={24}/>
                            }
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && currentWeather && (
                        <div
                            className="mt-6 p-4 bg-red-500/20 border border-red-300/50 rounded-2xl text-white max-w-lg mx-auto backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2">
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}
                </div>

                {currentWeather && (
                    <div className="grid xl:grid-cols-4 lg:grid-cols-3 gap-6 mb-8">
                        {/* Current Weather Main Card */}
                        <div
                            className="xl:col-span-2 lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-white border border-white/20 shadow-2xl">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <MapPin size={24} className="text-blue-300"/>
                                        <div>
                                            <h2 className="text-3xl font-bold">{city}</h2>
                                            <p className="text-white/60">{currentWeather.sys.country}</p>
                                        </div>
                                    </div>
                                    <p className="text-xl text-white/80 capitalize font-medium">
                                        {currentWeather.weather[0].description}
                                    </p>
                                    <div className="flex items-center gap-2 text-white/60 mt-2">
                                        <Clock size={16}/>
                                        <span>{new Date().toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="transform hover:scale-110 transition-transform duration-300">
                                        {getWeatherIcon(currentWeather.weather[0].icon, 80)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <div
                                        className="text-7xl font-bold mb-3 bg-gradient-to-b from-white to-blue-100 bg-clip-text text-transparent">
                                        {Math.round(currentWeather.main.temp)}°
                                    </div>
                                    <div className="text-xl text-white/70">
                                        Feels like {Math.round(currentWeather.main.feels_like)}°
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-blue-300">
                                            <ArrowDown size={18}/>
                                            <ArrowUp size={18}/>
                                        </div>
                                        <span className="text-lg">
                                            {Math.round(currentWeather.main.temp_min)}° / {Math.round(currentWeather.main.temp_max)}°
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                                        <Wind size={18} className="text-green-300"/>
                                        <span className="text-lg">
                                            {currentWeather.wind.speed} m/s {currentWeather.wind.deg && getWindDirection(currentWeather.wind.deg)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                                        <Droplets size={18} className="text-blue-300"/>
                                        <span className="text-lg">{currentWeather.main.humidity}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Weather Details Cards */}
                        <div className="space-y-6">
                            {/* Primary Details */}
                            <div
                                className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-white border border-white/20 shadow-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Gauge className="text-blue-300" size={20}/>
                                    Details
                                </h3>
                                <div className="space-y-4">
                                    <div
                                        className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <span className="flex items-center gap-2">
                                            <Eye size={16} className="text-purple-300"/>
                                            Visibility
                                        </span>
                                        <span
                                            className="font-semibold">{(currentWeather.visibility / 1000).toFixed(1)} km</span>
                                    </div>
                                    <div
                                        className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <span className="flex items-center gap-2">
                                            <Gauge size={16} className="text-orange-300"/>
                                            Pressure
                                        </span>
                                        <span className="font-semibold">{currentWeather.main.pressure} hPa</span>
                                    </div>
                                    <div
                                        className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <span className="flex items-center gap-2">
                                            <Cloud size={16} className="text-gray-300"/>
                                            Cloud Cover
                                        </span>
                                        <span className="font-semibold">{currentWeather.clouds.all}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sun Times */}
                            <div
                                className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-white border border-white/20 shadow-xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Sun className="text-yellow-300" size={20}/>
                                    Sun & Moon
                                </h3>
                                <div className="space-y-4">
                                    <div
                                        className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl backdrop-blur-sm">
                                        <span className="flex items-center gap-2">
                                            <Sunrise size={16} className="text-orange-300"/>
                                            Sunrise
                                        </span>
                                        <span className="font-semibold">{formatTime(currentWeather.sys.sunrise)}</span>
                                    </div>
                                    <div
                                        className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl backdrop-blur-sm">
                                        <span className="flex items-center gap-2">
                                            <Sunset size={16} className="text-purple-300"/>
                                            Sunset
                                        </span>
                                        <span className="font-semibold">{formatTime(currentWeather.sys.sunset)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Enhanced 5-Day Forecast */}
                {dailyForecast.length > 0 && (
                    <div
                        className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl mb-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Calendar size={28} className="text-blue-300"/>
                                5-Day Forecast
                            </h3>
                            <div className="text-white/60 text-sm">
                                Updated {new Date().toLocaleTimeString()}
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {dailyForecast.map((day, index) => (
                                <div
                                    key={index}
                                    className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-[1.02] shadow-lg ${
                                        day.isToday ? 'ring-2 ring-blue-400/50 bg-gradient-to-r from-blue-500/20 to-purple-500/20' : ''
                                    }`}
                                >
                                    {day.isToday && (
                                        <div
                                            className="absolute top-4 right-4 bg-blue-500/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium border border-blue-400/30">
                                            Today
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                        {/* Date and Day */}
                                        <div className="md:col-span-3">
                                            <div className="text-xl font-bold text-white">
                                                {day.isToday ? 'Today' : formatDate(day.date)}
                                            </div>
                                            <div className="text-sm text-white/60 font-medium">
                                                {formatFullDate(day.date)}
                                            </div>
                                        </div>

                                        {/* Weather Icon and Description */}
                                        <div className="md:col-span-3 flex items-center gap-3">
                                            <div
                                                className="transform hover:scale-110 transition-transform duration-300">
                                                {getWeatherIcon(day.weather.icon, 48)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white capitalize">
                                                    {day.weather.description}
                                                </div>
                                                <div className="text-xs text-white/60">
                                                    {day.weather.main}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Temperature */}
                                        <div className="md:col-span-2 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-2xl font-bold text-white">
                                                    {day.tempMax}°
                                                </span>
                                                <span className="text-lg text-white/60">
                                                    {day.tempMin}°
                                                </span>
                                            </div>
                                            <div className="text-xs text-white/60 mt-1">
                                                High / Low
                                            </div>
                                        </div>

                                        {/* Weather Stats */}
                                        <div className="md:col-span-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {/* Precipitation */}
                                            {day.maxPop > 0 && (
                                                <div
                                                    className="bg-blue-500/20 rounded-xl p-3 backdrop-blur-sm border border-blue-400/30">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Droplets size={14} className="text-blue-300"/>
                                                        <span className="text-xs text-white/80">Rain</span>
                                                    </div>
                                                    <div className="text-lg font-bold text-white">
                                                        {Math.round(day.maxPop * 100)}%
                                                    </div>
                                                    {day.totalRain > 0 && (
                                                        <div className="text-xs text-blue-200">
                                                            {day.totalRain.toFixed(1)}mm
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Wind */}
                                            <div
                                                className="bg-green-500/20 rounded-xl p-3 backdrop-blur-sm border border-green-400/30">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Wind size={14} className="text-green-300"/>
                                                    <span className="text-xs text-white/80">Wind</span>
                                                </div>
                                                <div className="text-lg font-bold text-white">
                                                    {day.maxWind.toFixed(1)}
                                                </div>
                                                <div className="text-xs text-green-200">
                                                    m/s max
                                                </div>
                                            </div>

                                            {/* Humidity */}
                                            <div
                                                className="bg-purple-500/20 rounded-xl p-3 backdrop-blur-sm border border-purple-400/30">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Droplets size={14} className="text-purple-300"/>
                                                    <span className="text-xs text-white/80">Humidity</span>
                                                </div>
                                                <div className="text-lg font-bold text-white">
                                                    {day.avgHumidity}%
                                                </div>
                                                <div className="text-xs text-purple-200">
                                                    average
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Temperature Trend Indicator */}
                                    <div
                                        className="absolute right-6 top-1/2 transform -translate-y-1/2 hidden lg:block">
                                        {index > 0 && (
                                            <div className="flex items-center gap-1">
                                                {dailyForecast[index].tempMax > dailyForecast[index - 1].tempMax ? (
                                                    <TrendingUp size={16} className="text-red-400"/>
                                                ) : dailyForecast[index].tempMax < dailyForecast[index - 1].tempMax ? (
                                                    <TrendingDown size={16} className="text-blue-400"/>
                                                ) : (
                                                    <div className="w-4 h-0.5 bg-white/40 rounded"></div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Forecast Legend */}
                        <div className="mt-6 pt-6 border-t border-white/20">
                            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/60">
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={14} className="text-red-400"/>
                                    <span>Temperature Rising</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrendingDown size={14} className="text-blue-400"/>
                                    <span>Temperature Falling</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Droplets size={14} className="text-blue-300"/>
                                    <span>Chance of Rain</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Wind size={14} className="text-green-300"/>
                                    <span>Wind Speed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hourly Forecast */}
                {hourlyForecast && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Clock size={28} className="text-emerald-300"/>
                                24-Hour Forecast
                            </h3>
                            <div className="text-white/60 text-sm">
                                Next 16 hours
                            </div>
                        </div>

                        <div className="overflow-x-auto pb-4">
                            <div className="flex gap-4" style={{minWidth: 'fit-content'}}>
                                {hourlyForecast.list.slice(0, 16).map((item, index) => {
                                    const currentDate = new Date();
                                    const itemDate = new Date(item.dt * 1000);
                                    const isToday = currentDate.toDateString() === itemDate.toDateString();

                                    return (
                                        <div
                                            key={index}
                                            className={`bg-white/10 backdrop-blur-sm rounded-2xl p-5 min-w-[140px] text-center text-white border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                                index === 0 ? 'ring-2 ring-emerald-400/50 bg-gradient-to-b from-emerald-500/20 to-blue-500/20' : ''
                                            }`}
                                        >
                                            <div className="text-sm font-medium text-white/80 mb-2">
                                                {index === 0 ? 'Now' : formatTime(item.dt)}
                                            </div>
                                            <div className="text-xs text-white/60 mb-3 font-medium">
                                                {isToday ? 'Today' : formatDate(item.dt)}
                                            </div>
                                            <div
                                                className="flex justify-center mb-3 transform hover:scale-110 transition-transform duration-300">
                                                {getWeatherIcon(item.weather[0].icon, 40)}
                                            </div>
                                            <div className="font-bold text-2xl mb-2 text-white">
                                                {Math.round(item.main.temp)}°
                                            </div>
                                            <div className="text-xs text-white/70 mb-3 capitalize font-medium">
                                                {item.weather[0].description}
                                            </div>
                                            {item.pop > 0 && (
                                                <div
                                                    className="text-xs text-blue-200 bg-blue-500/20 rounded-lg px-2 py-1 mb-2">
                                                    💧 {Math.round(item.pop * 100)}%
                                                </div>
                                            )}
                                            {item.rain && item.rain['3h'] && (
                                                <div
                                                    className="text-xs text-blue-300 bg-blue-600/20 rounded-lg px-2 py-1">
                                                    {item.rain['3h'].toFixed(1)}mm
                                                </div>
                                            )}
                                            <div
                                                className="flex items-center justify-center gap-1 text-xs text-white/60 mt-2">
                                                <Wind size={12}/>
                                                <span>{item.wind?.speed?.toFixed(1) || 0} m/s</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeatherDashboard;