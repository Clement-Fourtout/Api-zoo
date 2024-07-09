
require('dotenv').config();

const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');
const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());


const pool = mysql.createPool(process.env.JAWSDB_URL)

pool.query('SELECT * FROM services', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la requête SQL :', error);
      return;
    }
    console.log('Résultats de la requête :', results);
  });

// Middleware pour parser le JSON
app.use(express.json());

const corsOptions = {
    origin: 'https://zoo-arcadia-31989dc8c54b.herokuapp.com',
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Méthodes HTTP autorisées
    allowedHeaders: ['Content-Type', 'Authorization'], // En-têtes autorisés
};

AWS.config.update({
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Configuration de multer pour utiliser S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET,
        acl: 'private', // ou 'public-read' selon vos besoins
        key: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
});


app.use(cors());
app.use(express.json()); // Pour parser le JSON des requêtes

let tasks = [
    { id: 1, title: 'Etat de santé :' },
    { id: 2, title: 'Nourriture :' },
    { id: 3, title: 'Grammage :' },
    { id: 4, title: 'Date de passage :' },
];

// Récupérer toutes les tâches
app.get('/tasks', (req, res) => {
    res.json(tasks);
});

// Récupérer une tâche par son ID
app.get('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        res.json(task);
    } else {
        res.status(404).json({ message: 'Tâche non trouvée' });
    }
});

// Ajouter une nouvelle tâche
app.post('/tasks', (req, res) => {
    const { title } = req.body;
    const newTask = { id: tasks.length + 1, title };
    tasks.push(newTask);
    res.status(201).json(newTask);
});

// Mettre à jour une tâche existante
app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.title = req.body.title;
        res.json(task);
    } else {
        res.status(404).json({ message: 'Tâche non trouvée' });
    }
});

// Supprimer une tâche
app.delete('/users/:userId', (req, res) => {
    const userId = req.params.userId;

    // Requête pour supprimer l'utilisateur de la base de données
    const query = 'DELETE FROM utilisateurs WHERE id = ?';
    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Erreur lors de la suppression du compte utilisateur :', err);
            res.status(500).json({ message: 'Erreur lors de la suppression du compte utilisateur' });
        } else {
            if (result.affectedRows > 0) {
                console.log('Utilisateur supprimé avec succès de la base de données :', { userId });
                res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
            } else {
                console.log('Utilisateur non trouvé dans la base de données :', { userId });
                res.status(404).json({ message: 'Utilisateur non trouvé' });
            }
        }
    });
});

app.post('/login', async (req, res) => {
    const { nom, mot_de_passe } = req.body;

    try {
        console.log('Requête de connexion reçue avec les données suivantes :', { nom });

        const query = 'SELECT id, mot_de_passe, role FROM utilisateurs WHERE nom = ?';
        pool.query(query, [nom], async (err, result) => {
            if (err) {
                console.error('Erreur lors de la recherche de l\'utilisateur dans la base de données :', err);
                res.status(500).json({ message: 'Erreur lors de l\'authentification' });
                return;
            }
            if (result.length > 0) {
                const user = result[0];
                console.log('Mot de passe haché récupéré depuis la base de données : ', user.mot_de_passe);

                // Utilisez bcrypt.compare() pour comparer les mots de passe hachés
                bcrypt.compare(mot_de_passe, user.mot_de_passe, async (err, match) => {
                    if (err) {
                        console.error('Erreur lors de la comparaison des mots de passe :', err);
                        res.status(500).json({ message: 'Erreur lors de l\'authentification' });
                    } else {
                        if (match) {
                            // Le mot de passe saisi par l'utilisateur correspond au mot de passe haché dans la base de données
                            const token = jwt.sign({ nom }, 'votre_clé_secrète', { expiresIn: '1h' });
                            // Envoyez également le rôle de l'utilisateur dans la réponse JSON
                            res.json({ token, role: user.role, userId: user.id });
                        } else {
                            console.log('Mot de passe incorrect pour l\'utilisateur :', { nom });
                            res.status(401).json({ message: 'Mot de passe incorrect' });
                        }
                    }
                });
            } else {
                console.log('Utilisateur non trouvé dans la base de données :', { nom });
                res.status(404).json({ message: 'Utilisateur non trouvé' });
            }
        });
    } catch (error) {
        console.error('Erreur lors de la recherche de l\'utilisateur dans la base de données :', error);
        res.status(500).json({ message: 'Erreur Base de donnée' });
    }
});

function generateSecurePassword() {
    return Math.random().toString(36).slice(-8);
}

app.post('/register', async (req, res) => {
    const { nom, role, email} = req.body;

    try {
        // Générer un mot de passe sécurisé de manière asynchrone
        const mot_de_passe = await generateSecurePassword();
        console.log("Mot de passe généré:", mot_de_passe)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);

        // Insérer le nouvel utilisateur dans la table "utilisateurs"
        const query = 'INSERT INTO utilisateurs (nom, mot_de_passe, role, email) VALUES (?, ?, ?, ?)';
        pool.query(query, [nom, hashedPassword, role, email,], async (err, result) => {
            if (err) {
                console.error('Erreur lors de l\'enregistrement de l\'utilisateur dans la base de données :', err);
                return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
            } else {
                console.log('Utilisateur enregistré avec succès dans la base de données :', { nom, role });

                // Envoyer un e-mail de confirmation avec le logo inclus
                const transporter = nodemailer.createTransport({
                    host: 'smtp.office365.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.OUTLOOK_EMAIL,
                        pass: process.env.OUTLOOK_PASSWORD
                    }
                });

                // Lire le contenu de l'image de votre logo
                const logoContent = fs.readFileSync('./Img/Arcadia Zoo.png');

                const mailOptions = {
                    from: process.env.OUTLOOK_EMAIL,
                    to: email,
                    subject: 'Confirmation de création de compte',
                    html: `
                        <img src="cid:logo" alt="Zoo Arcadia">
                        <p>Bonjour ${nom},</p>
                        <p>Votre compte a été créé avec succès. Bienvenue dans notre entreprise !</p>
                        <p>Votre nom d'utilisateur est : ${nom}.</p>
                        <p>Veuillez contacter l'administrateur pour obtenir votre mot de passe.</p>
                    `,
                    attachments: [{
                        filename: 'Arcadia Zoo.png',
                        content: logoContent,
                        cid: 'logo' // Identifiant unique pour cette pièce jointe
                    }]
                };

                try {
                    await transporter.sendMail(mailOptions);
                    console.log('E-mail de confirmation envoyé');
                } catch (error) {
                    console.error('Erreur lors de l\'envoi de l\'e-mail de confirmation :', error);
                }

                return res.status(201).json({ message: 'Utilisateur créé avec succès', user: { nom, role, mot_de_passe } });
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
    }
});

app.post('/submit-review', (req, res) => {
    const { pseudo, avis } = req.body;

    const query = 'INSERT INTO avis_attente (pseudo, avis) VALUES (?, ?)';
    pool.query(query, [pseudo, avis], (err, result) => {
        if (err) {
            console.error('Erreur lors de la soumission de l\'avis :', err);
            return res.status(500).json({ message: 'Erreur lors de la soumission de l\'avis' });
        } else {
            console.log('Avis soumis avec succès :', { pseudo, avis });
            return res.status(200).json({ message: 'Avis soumis avec succès' });
        }
    });
});

app.get('/avis_attente', (req, res) => {
    const query = 'SELECT * FROM avis_attente';
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Erreur lors de la récupération des avis en attente :', err);
            return res.status(500).json({ message: 'Erreur lors de la récupération des avis en attente' });
        } else {
            console.log('Avis en attente récupérés avec succès :', {result});
            
            return res.status(200).json(result);
        }
    });
});

// Route pour valider un avis
app.post('/avis_valides', (req, res) => {
    const { id } = req.body;
    const querySelect = 'SELECT * FROM avis_attente WHERE id = ?';
    const queryInsert = 'INSERT INTO avis_valides (pseudo, avis) VALUES (?, ?)';
    const queryDelete = 'DELETE FROM avis_attente WHERE id = ?';

    pool.query(querySelect, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la sélection de l\'avis :', err);
            return res.status(500).json({ message: 'Erreur lors de la sélection de l\'avis' });
        }
        const avis = result[0]; // MySQL renvoie un tableau d'objets rows
        pool.query(queryInsert, [avis.pseudo, avis.avis], (err) => {
            if (err) {
                console.error('Erreur lors de l\'insertion de l\'avis validé :', err);
                return res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'avis validé' });
            }
            pool.query(queryDelete, [id], (err) => {
                if (err) {
                    console.error('Erreur lors de la suppression de l\'avis en attente :', err);
                    return res.status(500).json({ message: 'Erreur lors de la suppression de l\'avis en attente' });
                }
                console.log('Avis validé et transféré avec succès');
                res.status(200).json({ message: 'Avis validé avec succès' });
            });
        });
    });
});

// Route pour rejeter un avis
app.post('/avis_rejeter', (req, res) => {
    const { id } = req.body;
    const querySelect = 'SELECT * FROM avis_attente WHERE id = ?';
    const queryInsert = 'INSERT INTO avis_rejet (pseudo, avis) VALUES (?, ?)';
    const queryDelete = 'DELETE FROM avis_attente WHERE id = ?';

    pool.query(querySelect, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la sélection de l\'avis :', err);
            return res.status(500).json({ message: 'Erreur lors de la sélection de l\'avis' });
        }
        const avis = result[0]; // MySQL renvoie un tableau d'objets rows
        pool.query(queryInsert, [avis.pseudo, avis.avis], (err) => {
            if (err) {
                console.error('Erreur lors de l\'insertion de l\'avis rejeté :', err);
                return res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'avis rejeté' });
            }
            pool.query(queryDelete, [id], (err) => {
                if (err) {
                    console.error('Erreur lors de la suppression de l\'avis en attente :', err);
                    return res.status(500).json({ message: 'Erreur lors de la suppression de l\'avis en attente' });
                }
                console.log('Avis rejeté et transféré avec succès');
                res.status(200).json({ message: 'Avis rejeté avec succès' });
            });
        });
    });
});

// Route pour récupérer les avis validés
app.get('/avis_valides', (req, res) => {
    const query = 'SELECT * FROM avis_valides';
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Erreur lors de la récupération des avis validés :', err);
            return res.status(500).json({ message: 'Erreur lors de la récupération des avis validés' });
        }
        console.log('Avis validés récupérés avec succès :', result);
        return res.status(200).json(result);
    });
});
// Récupération des services 
app.get('/services', (req, res) => {
    pool.query('SELECT * FROM services', (err, results) => {
      if (err) {
        console.error('Erreur lors de la récupération des services :', err);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des services' });
      } else {
        res.json(results);
      }
    });
  });


  
  app.post('/services', upload.single('image_url'), async (req, res) => {
    const { title, description } = req.body;
    const imageUrl = req.file.location;

    // Insérer les données dans la base de données
    try {
        const query = 'INSERT INTO services (title, description, image_url) VALUES (?, ?, ?)';
        await pool.query(query, [title, description, imageUrl]);

        res.status(201).json({ message: 'Service ajouté avec succès', service: { title, description, imageUrl } });
    } catch (error) {
        console.error('Erreur lors de l\'insertion du service :', error);
        res.status(500).json({ message: 'Erreur lors de l\'insertion du service' });
    }
});

  
  // Mettre à jour un service existant
  app.put('/services/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, image_url } = req.body;
  
      // Vérifiez si les champs requis sont présents
      if (!title || !description || !image_url) {
        return res.status(400).json({ message: 'Veuillez fournir un titre, une description et une URL d\'image.' });
      }
  
      const query = 'UPDATE services SET title = ?, description = ?, image_url = ? WHERE id = ?';
      pool.query(query, [title, description, image_url, id], (err, result) => {
        if (err) {
          console.error('Erreur lors de la modification du service :', err);
          return res.status(500).json({ message: 'Erreur lors de la modification du service' });
        }
        console.log('Service modifié avec succès :', result);
        return res.status(200).json({ id, title, description, image_url });
      });
    } catch (error) {
      console.error('Erreur inattendue :', error);
      return res.status(500).json({ message: 'Erreur serveur inattendue' });
    }
  });
  
  
  // Supprimer un service
  app.delete('/services/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM services WHERE id = ?';
    pool.query(query, [id], (err, result) => {
      if (err) {
        console.error('Erreur lors de la suppression du service :', err);
        return res.status(500).json({ message: 'Erreur lors de la suppression du service' });
      }
      console.log('Service supprimé avec succès :', result);
      return res.status(200).json({ message: 'Service supprimé avec succès' });
    });
  });



app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});