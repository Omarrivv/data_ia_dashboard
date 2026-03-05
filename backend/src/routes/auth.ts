import express from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { User } from '../models/User';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from '../types';

const router = express.Router();

// Esquemas de validación
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 100 caracteres',
    'any.required': 'El nombre es requerido'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Debe ser un email válido',
    'any.required': 'El email es requerido'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es requerida'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Debe ser un email válido',
    'any.required': 'El email es requerido'
  }),
  password: Joi.string().required().messages({
    'any.required': 'La contraseña es requerida'
  })
});

// Función para generar JWT
const generateToken = (userId: string, email: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado');
  }
  
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse<AuthResponse>>) => {
  // Validar datos de entrada
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { name, email, password }: RegisterRequest = value;

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createError('El email ya está registrado', 400);
  }

  // Crear nuevo usuario
  const user = new User({
    name,
    email,
    password
  });

  await user.save();

  // Generar token
  const token = generateToken(user._id.toString(), user.email);

  res.status(201).json({
    success: true,
    data: {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    },
    message: 'Usuario registrado exitosamente'
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse<AuthResponse>>) => {
  // Validar datos de entrada
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { email, password }: LoginRequest = value;

  // Buscar usuario con contraseña
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw createError('Credenciales inválidas', 401);
  }

  // Verificar contraseña
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw createError('Credenciales inválidas', 401);
  }

  // Generar token
  const token = generateToken(user._id.toString(), user.email);

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    },
    message: 'Inicio de sesión exitoso'
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Obtener perfil del usuario actual
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no encontrado', 404);
  }

  res.json({
    success: true,
    data: {
      _id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt
    }
  });
}));

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil del usuario
 * @access  Private
 */
router.put('/profile', authenticate, asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no encontrado', 404);
  }

  const updateSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional()
  });

  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  // Verificar si el nuevo email ya existe
  if (value.email && value.email !== req.user.email) {
    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) {
      throw createError('El email ya está en uso', 400);
    }
  }

  // Actualizar usuario
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    value,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: updatedUser,
    message: 'Perfil actualizado exitosamente'
  });
}));

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña del usuario
 * @access  Private
 */
router.post('/change-password', authenticate, asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no encontrado', 404);
  }

  const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'La contraseña actual es requerida'
    }),
    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'La nueva contraseña debe tener al menos 6 caracteres',
      'any.required': 'La nueva contraseña es requerida'
    })
  });

  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;

  // Obtener usuario con contraseña
  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw createError('Usuario no encontrado', 404);
  }

  // Verificar contraseña actual
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw createError('Contraseña actual incorrecta', 400);
  }

  // Actualizar contraseña
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Contraseña actualizada exitosamente'
  });
}));

export default router;