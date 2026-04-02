const axios = require('axios');

const test = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/auth/check-admin');
        console.log("API Status Check:", res.data);
    } catch (err) {
        console.error("API Connection ERROR:", err.message);
    }
};

test();
