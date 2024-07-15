const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  name: String,
  species: String,
  consultations: { type: Number, default: 0 }
});
const Animal = mongoose.model('Animal', animalSchema);
module.exports = Animal;