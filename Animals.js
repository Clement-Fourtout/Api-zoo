const mongoose = require('mongoose');

// Définition du schéma pour les animaux
const animalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    species: { type: String, required: true },
    age: { type: Number },
    increment: { type: Number, default: 0 } // Champ pour le nombre de consultations
});

// Définition du modèle Animal basé sur le schéma
const Animal = mongoose.model('Animal', animalSchema);

// Exportation du modèle Animal pour pouvoir l'utiliser dans d'autres fichiers
module.exports = Animal;
