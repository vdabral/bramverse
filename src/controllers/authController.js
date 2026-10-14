const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanName || cleanName.length > 100 || !validEmail(cleanEmail) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Valid name, email, and password (8–128 characters) are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({
      data: { name: cleanName, email: cleanEmail, password: passwordHash },
      select: { id: true, name: true, email: true }
    });

    return res.status(201).json({ message: 'Employee registered successfully', employee });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Employee already registered' });
    }
    console.error('Register error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!validEmail(cleanEmail) || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Valid email and password are required' });
    }

    const employee = await prisma.employee.findUnique({ where: { email: cleanEmail } });
    if (!employee || !(await bcrypt.compare(password, employee.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { employeeId: employee.id },
      process.env.JWT_SECRET,
      { expiresIn: '1d', algorithm: 'HS256' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      employee: { id: employee.id, name: employee.name, email: employee.email }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, login };
