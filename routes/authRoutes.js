
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user'); // Assurez-vous d'avoir un modèle pour les utilisateurs

// Route pour la connexion des utilisateurs
router.post('/login', async (req, res) => {
    const { nom, mot_de_passe } = req.body;

    try {
        // Recherchez l'utilisateur dans la base de données par nom d'utilisateur
        const user = await User.findOne({ nom });

        if (!user) {
            return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        // Vérifiez si le mot de passe correspond
        const mot_de_passeMatch = await bcrypt.compare(mot_de_passe, user.password);

        if (!mot_de_passeMatch) {
            return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        // Si l'authentification réussit, générez un jeton JWT
        const token = jwt.sign({ nom: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Renvoyez le jeton JWT à l'utilisateur
        res.json({ token });
    } catch (error) {
        console.error('Erreur de connexion :', error);
        res.status(500).json({ message: 'Erreur de connexion' });
    }
});

module.exports = router;
