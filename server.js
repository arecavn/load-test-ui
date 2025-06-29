const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

// Store active tests and test history
const activeTests = new Map();
const testHistoryFile = path.join(__dirname, 'test-history.json');

// User profile templates for realistic simulation
const USER_PROFILES = {
    desktop: {
        userAgents: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
        ],
        acceptLanguages: ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8'],
        acceptEncodings: ['gzip, deflate, br', 'gzip, deflate'],
        connections: ['keep-alive', 'close']
    },
    mobile: {
        userAgents: [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
        ],
        acceptLanguages: ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'es-ES,es;q=0.9,en;q=0.8'],
        acceptEncodings: ['gzip, deflate, br'],
        connections: ['keep-alive']
    },
    api: {
        userAgents: [
            'PostmanRuntime/7.36.0',
            'insomnia/2023.5.8',
            'curl/8.4.0',
            'HTTPie/3.2.2',
            'axios/1.6.0'
        ],
        acceptLanguages: ['*'],
        acceptEncodings: ['gzip, deflate'],
        connections: ['keep-alive', 'close']
    }
};

// Sample data generators for dynamic content
const DATA_GENERATORS = {
    names: ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom', 'Anna'],
    emails: ['user1@example.com', 'user2@test.com', 'user3@demo.org', 'test@sample.net'],
    cities: ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Mumbai'],
    products: ['laptop', 'phone', 'tablet', 'monitor', 'keyboard', 'mouse', 'headphones', 'camera'],
    categories: ['electronics', 'books', 'clothing', 'home', 'sports', 'toys', 'music', 'movies'],
    statuses: ['active', 'pending', 'completed', 'cancelled', 'processing', 'shipped', 'delivered']
};

// Generate a realistic user profile
function generateUserProfile(profileType = 'mixed') {
    let profile;
    
    if (profileType === 'mixed') {
        const types = ['desktop', 'mobile', 'api'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        profile = USER_PROFILES[randomType];
    } else {
        profile = USER_PROFILES[profileType] || USER_PROFILES.desktop;
    }
    
    return {
        userAgent: profile.userAgents[Math.floor(Math.random() * profile.userAgents.length)],
        acceptLanguage: profile.acceptLanguages[Math.floor(Math.random() * profile.acceptLanguages.length)],
        acceptEncoding: profile.acceptEncodings[Math.floor(Math.random() * profile.acceptEncodings.length)],
        connection: profile.connections[Math.floor(Math.random() * profile.connections.length)],
        sessionId: uuidv4(),
        userId: Math.floor(Math.random() * 100000),
        deviceId: uuidv4().substring(0, 8)
    };
}

// Generate dynamic request data
function generateDynamicData(template, userProfile) {
    if (!template) return null;
    
    let dynamicData = JSON.parse(JSON.stringify(template));
    
    // Replace placeholders with dynamic values
    const replacements = {
        '{{timestamp}}': Date.now(),
        '{{random_id}}': Math.floor(Math.random() * 1000000),
        '{{session_id}}': userProfile.sessionId,
        '{{user_id}}': userProfile.userId,
        '{{device_id}}': userProfile.deviceId,
        '{{uuid}}': uuidv4(),
        '{{random_name}}': DATA_GENERATORS.names[Math.floor(Math.random() * DATA_GENERATORS.names.length)],
        '{{random_email}}': DATA_GENERATORS.emails[Math.floor(Math.random() * DATA_GENERATORS.emails.length)],
        '{{random_city}}': DATA_GENERATORS.cities[Math.floor(Math.random() * DATA_GENERATORS.cities.length)],
        '{{random_product}}': DATA_GENERATORS.products[Math.floor(Math.random() * DATA_GENERATORS.products.length)],
        '{{random_category}}': DATA_GENERATORS.categories[Math.floor(Math.random() * DATA_GENERATORS.categories.length)],
        '{{random_status}}': DATA_GENERATORS.statuses[Math.floor(Math.random() * DATA_GENERATORS.statuses.length)],
        '{{random_number}}': Math.floor(Math.random() * 1000),
        '{{random_float}}': (Math.random() * 100).toFixed(2)
    };
    
    const jsonString = JSON.stringify(dynamicData);
    const replacedString = Object.keys(replacements).reduce((str, placeholder) => {
        return str.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[placeholder]);
    }, jsonString);
    
    try {
        return JSON.parse(replacedString);
    } catch (e) {
        return template;
    }
}

// Add cache-busting parameters to URL
function addCacheBusting(url, options = {}) {
    const urlObj = new URL(url);
    
    if (options.addTimestamp !== false) {
        urlObj.searchParams.set('_t', Date.now().toString());
    }
    
    if (options.addRandomId !== false) {
        urlObj.searchParams.set('_r', Math.random().toString(36).substring(2, 15));
    }
    
    if (options.addSessionId) {
        urlObj.searchParams.set('_sid', options.sessionId || uuidv4());
    }
    
    return urlObj.toString();
}

// Load test history from file
function loadTestHistory() {
    try {
        if (fs.existsSync(testHistoryFile)) {
            const data = fs.readFileSync(testHistoryFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading test history:', error.message);
    }
    return [];
}

// Save test history to file
function saveTestHistory(history) {
    try {
        fs.writeFileSync(testHistoryFile, JSON.stringify(history, null, 2));
    } catch (error) {
        console.log('Error saving test history:', error.message);
    }
}

// Initialize test history
let testHistory = loadTestHistory();

// Store recent test results for sample cases
let recentTestResults = {
    successes: [], // Array of successful request/response examples
    failures: []   // Array of failed request/response examples
};

// Function to add a test result to recent examples
function addTestResult(type, result) {
    const maxResults = 10; // Keep only last 10 results of each type
    
    if (type === 'success') {
        recentTestResults.successes.unshift(result);
        if (recentTestResults.successes.length > maxResults) {
            recentTestResults.successes = recentTestResults.successes.slice(0, maxResults);
        }
    } else if (type === 'failure') {
        recentTestResults.failures.unshift(result);
        if (recentTestResults.failures.length > maxResults) {
            recentTestResults.failures = recentTestResults.failures.slice(0, maxResults);
        }
    }
}

// Function to get recent test examples for sample cases
function getRecentTestExamples() {
    return {
        successes: recentTestResults.successes.slice(0, 3), // Return max 3 examples
        failures: recentTestResults.failures.slice(0, 3)    // Return max 3 examples
    };
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints for test history
app.get('/api/history', (req, res) => {
    res.json(testHistory);
});

app.post('/api/history/:id/run', (req, res) => {
    const historyId = req.params.id;
    const historyItem = testHistory.find(item => item.id === historyId);
    
    if (!historyItem) {
        return res.status(404).json({ error: 'Test history not found' });
    }
    
    res.json({ 
        message: 'Test configuration loaded', 
        config: historyItem.config 
    });
});

app.delete('/api/history/:id', (req, res) => {
    const historyId = req.params.id;
    const index = testHistory.findIndex(item => item.id === historyId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Test history not found' });
    }
    
    testHistory.splice(index, 1);
    saveTestHistory(testHistory);
    res.json({ message: 'Test history deleted' });
});

app.delete('/api/history', (req, res) => {
    testHistory = [];
    saveTestHistory(testHistory);
    res.json({ message: 'All test history cleared' });
});

// API endpoint to get recent test examples for sample cases
app.get('/api/recent-examples', (req, res) => {
    res.json(getRecentTestExamples());
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('start-test', async (config) => {
        const testId = uuidv4();
        const test = {
            id: testId,
            config: config,
            startTime: Date.now(),
            isRunning: true,
            stats: {
                sentRequests: 0,
                receivedResponses: 0,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                responseTimes: [],
                errors: [],
                statusCodes: {},
                requestsToSend: config.totalRequests || 100, // Total requests to send
                requestsSentCount: 0, // Track how many have been sent
                minResponseTime: Infinity,
                maxResponseTime: 0
            }
        };

        activeTests.set(testId, test);
        
        socket.emit('test-started', { testId: testId });
        console.log(`Test ${testId} started with ${config.concurrentUsers} users and ${config.totalRequests} total requests`);

        // Execute the load test
        executeLoadTest(test, socket);
    });

    socket.on('stop-test', (testId) => {
        if (activeTests.has(testId)) {
            const test = activeTests.get(testId);
            test.isRunning = false;
            console.log('Test stopped:', testId);
            socket.emit('test-stopped', { testId });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

async function executeLoadTest(test, socket) {
    const { config } = test;
    const { url, method, headers, body, concurrentUsers, delayBetweenRequests } = config;

    const promises = [];
    const startTime = Date.now();
    
    // Create concurrent users
    for (let i = 0; i < concurrentUsers; i++) {
        promises.push(simulateUser(test, socket, i));
    }

    // Wait for all users to complete or test to stop
    await Promise.all(promises);

    // Complete the test if it's still running
    if (test.isRunning) {
        test.isRunning = false;
        socket.emit('test-completed', {
            testId: test.id,
            stats: calculateFinalStats(test)
        });
    }

    // Save test to history
    const historyItem = {
        id: test.id,
        config: test.config,
        stats: calculateFinalStats(test),
        timestamp: new Date().toISOString(),
        endTime: Date.now(),
        duration: (Date.now() - test.startTime) / 1000
    };
    
    testHistory.unshift(historyItem); // Add to beginning
    
    // Keep only last 50 tests
    if (testHistory.length > 50) {
        testHistory = testHistory.slice(0, 50);
    }
    
    saveTestHistory(testHistory);
}

async function simulateUser(test, socket, userId) {
    const { config } = test;
    const { url, method, headers, body, delayBetweenRequests, userProfileType, enableCacheBusting, enableDynamicData } = config;

    // Generate a unique user profile for this simulated user
    const userProfile = generateUserProfile(userProfileType || 'mixed');
    
    console.log(`User ${userId}: Profile generated - ${userProfile.userAgent.substring(0, 50)}...`);

    while (test.isRunning) {
        // Use atomic operation to check and decrement available requests
        if (test.stats.requestsToSend <= 0) {
            break; // No more requests to send
        }
        
        // Reserve a request slot
        test.stats.requestsToSend--;
        test.stats.requestsSentCount++;
        
        const requestStart = Date.now();
        
        // Increment sent requests immediately
        test.stats.sentRequests++;
        
        // Emit immediate update for sent requests
        socket.emit('test-update', {
            testId: test.id,
            stats: calculateCurrentStats(test),
            userId: userId,
            event: 'request-sent'
        });

        try {
            // Generate dynamic URL with cache busting if enabled
            let dynamicUrl = url;
            if (enableCacheBusting !== false) {
                dynamicUrl = addCacheBusting(url, {
                    addTimestamp: true,
                    addRandomId: true,
                    addSessionId: config.addSessionId,
                    sessionId: userProfile.sessionId
                });
            }

            // Create realistic headers with user profile
            const dynamicHeaders = {
                ...headers,
                'User-Agent': userProfile.userAgent,
                'Accept-Language': userProfile.acceptLanguage,
                'Accept-Encoding': userProfile.acceptEncoding,
                'Connection': userProfile.connection,
                'X-Session-ID': userProfile.sessionId,
                'X-User-ID': userProfile.userId.toString(),
                'X-Device-ID': userProfile.deviceId,
                'X-Request-ID': uuidv4(),
                'X-Timestamp': Date.now().toString()
            };

            // Remove null/undefined headers
            Object.keys(dynamicHeaders).forEach(key => {
                if (dynamicHeaders[key] === null || dynamicHeaders[key] === undefined || dynamicHeaders[key] === '') {
                    delete dynamicHeaders[key];
                }
            });

            const requestConfig = {
                method: method.toLowerCase(),
                url: dynamicUrl,
                headers: dynamicHeaders,
                timeout: 30000,
                validateStatus: function (status) {
                    return status >= 100 && status < 600; // Accept all valid HTTP status codes
                }
            };

            // Handle dynamic body data
            if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
                let dynamicBody = body;
                
                // Generate dynamic data if enabled
                if (enableDynamicData !== false) {
                    try {
                        const bodyTemplate = typeof body === 'string' ? JSON.parse(body) : body;
                        dynamicBody = generateDynamicData(bodyTemplate, userProfile);
                    } catch (e) {
                        // If body is not JSON, add some dynamic elements
                        if (typeof body === 'string') {
                            dynamicBody = body
                                .replace(/{{timestamp}}/g, Date.now())
                                .replace(/{{session_id}}/g, userProfile.sessionId)
                                .replace(/{{user_id}}/g, userProfile.userId)
                                .replace(/{{random_id}}/g, Math.floor(Math.random() * 1000000));
                        }
                    }
                }

                if (typeof dynamicBody === 'string') {
                    requestConfig.data = dynamicBody;
                } else {
                    requestConfig.data = JSON.stringify(dynamicBody);
                }
                
                // Ensure Content-Type is set if not already provided
                if (!requestConfig.headers['Content-Type'] && !requestConfig.headers['content-type']) {
                    requestConfig.headers['Content-Type'] = 'application/json';
                }
            }

            console.log(`User ${userId}: Making ${method} request to ${url}`);
            console.log(`User ${userId}: Headers:`, JSON.stringify(requestConfig.headers, null, 2));
            if (requestConfig.data) {
                console.log(`User ${userId}: Body:`, requestConfig.data.substring(0, 200) + (requestConfig.data.length > 200 ? '...' : ''));
            }
            
            const response = await axios(requestConfig);
            const responseTime = Date.now() - requestStart;

            console.log(`User ${userId}: Got response ${response.status} in ${responseTime}ms`);
            console.log(`User ${userId}: Response headers:`, JSON.stringify(response.headers, null, 2));
            console.log(`User ${userId}: Response data:`, typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data, null, 2).substring(0, 500));

            // Update statistics for received response - only 200 is success
            const isSuccess = response.status === 200;
            updateStatsForResponse(test, responseTime, isSuccess, response.status);
            
            // Capture test result for sample cases
            const testResult = {
                timestamp: new Date().toISOString(),
                config: {
                    url: dynamicUrl,
                    method: method.toUpperCase(),
                    headers: dynamicHeaders,
                    body: requestConfig.data ? requestConfig.data.substring(0, 1000) : null
                },
                response: {
                    status: response.status,
                    responseTime: responseTime,
                    headers: response.headers,
                    data: typeof response.data === 'string' ? response.data.substring(0, 2000) : JSON.stringify(response.data, null, 2).substring(0, 2000)
                },
                userProfile: {
                    userAgent: userProfile.userAgent,
                    sessionId: userProfile.sessionId,
                    userId: userProfile.userId
                }
            };
            
            if (isSuccess) {
                addTestResult('success', testResult);
            } else {
                addTestResult('failure', testResult);
            }
            
            // Emit real-time update for response with response data
            socket.emit('test-update', {
                testId: test.id,
                stats: calculateCurrentStats(test),
                userId: userId,
                responseTime: responseTime,
                status: response.status,
                statusCode: response.status,
                responseData: typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data, null, 2).substring(0, 200),
                responseHeaders: response.headers,
                event: 'response-received'
            });

        } catch (error) {
            const responseTime = Date.now() - requestStart;
            
            console.log(`User ${userId}: Request failed - ${error.message} (${responseTime}ms)`);
            if (error.response) {
                console.log(`User ${userId}: Response status: ${error.response.status}`);
                console.log(`User ${userId}: Response headers:`, JSON.stringify(error.response.headers, null, 2));
                console.log(`User ${userId}: Response data:`, typeof error.response.data === 'string' ? error.response.data.substring(0, 500) : JSON.stringify(error.response.data, null, 2).substring(0, 500));
                
                // Update statistics with error response status - only 200 is success
                const isSuccess = error.response.status === 200;
                updateStatsForResponse(test, responseTime, isSuccess, error.response.status);
                if (error.message) {
                    test.stats.errors.push(error.message);
                }
                
                // Capture failure test result for sample cases
                const failureResult = {
                    timestamp: new Date().toISOString(),
                    config: {
                        url: dynamicUrl,
                        method: method.toUpperCase(),
                        headers: dynamicHeaders,
                        body: requestConfig.data ? requestConfig.data.substring(0, 1000) : null
                    },
                    response: {
                        status: error.response.status,
                        responseTime: responseTime,
                        headers: error.response.headers,
                        data: typeof error.response.data === 'string' ? error.response.data.substring(0, 2000) : JSON.stringify(error.response.data, null, 2).substring(0, 2000),
                        error: error.message
                    },
                    userProfile: {
                        userAgent: userProfile.userAgent,
                        sessionId: userProfile.sessionId,
                        userId: userProfile.userId
                    }
                };
                addTestResult('failure', failureResult);
                
            } else {
                // Network error or timeout - definitely not success
                updateStatsForResponse(test, responseTime, false, null);
                test.stats.errors.push(error.message);
                
                // Capture timeout/network failure result for sample cases
                const networkFailureResult = {
                    timestamp: new Date().toISOString(),
                    config: {
                        url: dynamicUrl,
                        method: method.toUpperCase(),
                        headers: dynamicHeaders,
                        body: requestConfig.data ? requestConfig.data.substring(0, 1000) : null
                    },
                    response: {
                        status: null,
                        responseTime: responseTime,
                        headers: null,
                        data: null,
                        error: error.message
                    },
                    userProfile: {
                        userAgent: userProfile.userAgent,
                        sessionId: userProfile.sessionId,
                        userId: userProfile.userId
                    }
                };
                addTestResult('failure', networkFailureResult);
            }
            
            // Emit error update with response data
            socket.emit('test-update', {
                testId: test.id,
                stats: calculateCurrentStats(test),
                userId: userId,
                responseTime: responseTime,
                error: error.message,
                statusCode: error.response ? error.response.status : null,
                responseData: error.response ? (typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : JSON.stringify(error.response.data, null, 2).substring(0, 200)) : null,
                responseHeaders: error.response ? error.response.headers : null,
                event: 'response-received'
            });
        }

        // Delay between requests
        if (delayBetweenRequests > 0 && test.isRunning) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
    }
}

function updateStatsForResponse(test, responseTime, success, statusCode = null) {
    const stats = test.stats;
    
    stats.receivedResponses++;
    stats.totalRequests++;
    
    // Only count status code 200 as successful
    if (success && statusCode === 200) {
        stats.successfulRequests++;
    } else {
        stats.failedRequests++;
    }

    // Track count for each status code
    if (statusCode !== null) {
        if (!stats.statusCodes[statusCode]) {
            stats.statusCodes[statusCode] = 0;
        }
        stats.statusCodes[statusCode]++;
    }

    stats.responseTimes.push(responseTime);
    stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
    stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
}

function calculateCurrentStats(test) {
    const stats = test.stats;
    const elapsedTime = (Date.now() - test.startTime) / 1000;
    
    // Calculate average response time
    if (stats.responseTimes.length > 0) {
        stats.avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
        
        // Calculate percentiles (TP90, TP95)
        const sortedTimes = [...stats.responseTimes].sort((a, b) => a - b);
        stats.tp90 = calculatePercentile(sortedTimes, 90);
        stats.tp95 = calculatePercentile(sortedTimes, 95);
    } else {
        stats.tp90 = 0;
        stats.tp95 = 0;
    }
    
    // Calculate requests per second
    stats.requestsPerSecond = stats.totalRequests / elapsedTime;
    stats.responseRate = stats.receivedResponses / elapsedTime;
    
    return {
        ...stats,
        elapsedTime: elapsedTime,
        successRate: stats.totalRequests > 0 ? (stats.successfulRequests / stats.totalRequests) * 100 : 0
    };
}

function calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
        return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

function calculateFinalStats(test) {
    return calculateCurrentStats(test);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Load Test Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
