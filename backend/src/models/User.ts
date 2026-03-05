import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User as IUser, UserRole } from '../types';
// Interfaz para el documento de usuario
export interface UserDocument extends Omit<IUser, '_id'>, Document {
  password: string;
  role: UserRole;
  comparePassword(candidatePassword: string): Promise<boolean>;
}
// Esquema de usuario
const userSchema = new Schema<UserDocument>({
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor ingresa un email válido'
    ]
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No incluir en queries por defecto
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      if (ret.password) delete ret.password;
      if (ret.__v !== undefined) delete ret.__v;
      return ret;
    }
  }
});

// Índices
// userSchema.index({ email: 1 }); // Removido porque ya está definido como unique: true
userSchema.index({ createdAt: -1 });

// Middleware pre-save para hashear contraseña
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método estático para buscar por email
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email }).select('+password');
};

export const User = mongoose.model<UserDocument>('User', userSchema);