const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  name: String,
  type: String,
  increment: { type: Number, default: 0 }
});

// Création du modèle Animal à partir du schéma
const Animal = mongoose.model('Animal', animalSchema);

module.exports = Animal;