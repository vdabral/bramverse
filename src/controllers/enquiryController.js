const prisma = require('../lib/prisma');

const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const createEnquiry = async (req, res) => {
  try {
    const { name, email, courseInterest, phone } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanCourse = typeof courseInterest === 'string' ? courseInterest.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : null;

    if (!cleanName || cleanName.length > 100 || !validEmail(cleanEmail) ||
        !cleanCourse || cleanCourse.length > 150 ||
        (phone != null && (typeof phone !== 'string' || cleanPhone.length > 25))) {
      return res.status(400).json({ message: 'Valid name, email, courseInterest, and optional phone are required' });
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        courseInterest: cleanCourse,
        phone: cleanPhone || null
      }
    });

    return res.status(201).json({ message: 'Enquiry submitted successfully', enquiry });
  } catch (error) {
    console.error('Create enquiry error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getUnclaimedEnquiries = async (req, res) => {
  try {
    const enquiries = await prisma.enquiry.findMany({
      where: { claimedById: null },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ count: enquiries.length, enquiries });
  } catch (error) {
    console.error('Unclaimed enquiries error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const claimEnquiry = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid enquiry ID' });
    }

    // One atomic conditional write: only ONE concurrent employee can win.
    const result = await prisma.enquiry.updateMany({
      where: { id, claimedById: null },
      data: { claimedById: req.employeeId }
    });

    if (result.count === 0) {
      const existing = await prisma.enquiry.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!existing) return res.status(404).json({ message: 'Enquiry not found' });
      return res.status(409).json({ message: 'Enquiry already claimed' });
    }

    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    return res.status(200).json({ message: 'Enquiry claimed successfully', enquiry });
  } catch (error) {
    console.error('Claim enquiry error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getMyEnquiries = async (req, res) => {
  try {
    const enquiries = await prisma.enquiry.findMany({
      where: { claimedById: req.employeeId },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ count: enquiries.length, enquiries });
  } catch (error) {
    console.error('My enquiries error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { createEnquiry, getUnclaimedEnquiries, claimEnquiry, getMyEnquiries };
