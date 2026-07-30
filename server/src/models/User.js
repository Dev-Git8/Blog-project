import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_-]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true, maxlength: 60, default: '' },
    bio: { type: String, trim: true, maxlength: 280, default: '' },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true },
)

userSchema.pre('validate', function setDisplayName(next) {
  if (!this.displayName) this.displayName = this.username
  next()
})

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash)
}

export const User = mongoose.model('User', userSchema)
