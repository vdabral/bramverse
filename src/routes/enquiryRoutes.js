const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createEnquiry,
  getUnclaimedEnquiries,
  claimEnquiry,
  getMyEnquiries
} = require('../controllers/enquiryController');

router.post('/', createEnquiry); // PUBLIC: no JWT
router.get('/unclaimed', authMiddleware, getUnclaimedEnquiries);
router.get('/my-leads', authMiddleware, getMyEnquiries);
router.patch('/:id/claim', authMiddleware, claimEnquiry);

module.exports = router;
