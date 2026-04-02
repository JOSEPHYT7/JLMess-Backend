const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['staff', 'admin'],
        default: 'staff'
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    activeSessions: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

userSchema.index({ role: 1 });

userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    if (this.activeSessions === undefined) {
        this.activeSessions = 0;
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
