
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
const mongoose = require('mongoose');
const router = express.Router();
const PORT = process.env.PORT || 3000;
const MongoClient = require('mongodb').MongoClient;

const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const hosts = process.env.MONGODB_HOSTS;
const database = process.env.MONGODB_DATABASE;
const options = process.env.MONGODB_OPTIONS;
const connectionString = 'mongodb://' + username + ':' + password + '@' + hosts + '/' + database + options;

MongoClient.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Temps maximum pour sélectionner un serveur (en ms)
    socketTimeoutMS: 45000, // Temps maximum pour l'activité du socket (en ms)
    connectTimeoutMS: 10000 // Temps maximum pour établir une connexion (en ms)
  }, (err, client) => {
    if (err) {
      console.log('Error connecting to MongoDB:', err);
      process.exit(1);
    } else {
      console.log('Connected to MongoDB!');
      client.close();
    }
  });

// Middleware pour parser le JSON

app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json());
app.use(bodyParser.json({limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // Gestion des erreurs spécifiques à Multer
      console.error('Erreur Multer :', err);
      res.status(500).json({ error: 'Erreur serveur lors de l\'upload de l\'image' });
    } else {
      // Gestion des autres erreurs
      console.error('Erreur générale :', err);
      res.status(500).json({ error: 'Erreur serveur inattendue' });
    }
  });

const pool = mysql.createPool(process.env.JAWSDB_URL)

pool.query('SELECT * FROM services', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la requête SQL :', error);
      return;
    }
    console.log('Résultats de la requête :', results);
  });


const corsOptions = {
    origin: 'https://zoo-arcadia-31989dc8c54b.herokuapp.com',
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Méthodes HTTP autorisées
    allowedHeaders: ['Content-Type', 'Authorization'], // En-têtes autorisés
};


const s3 = new AWS.S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
 
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET,
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '-' + file.originalname);
        },
    }),
    limits: { fileSize: 1024 * 1024 * 10 },
});
const animalSchema = new mongoose.Schema({
    name: String,
    species: String,
    age: Number
  });
  const animalViewSchema = new mongoose.Schema({
    animalId: String,
    animalName: String, // Ajoutez cette ligne
    viewCount: { type: Number, default: 0 }
  });
  

  const Animal = mongoose.model('Animal', animalSchema);
  const AnimalView = mongoose.model('AnimalView', animalViewSchema);


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

app.get('/roles', (req, res) => {
    const query = 'SELECT DISTINCT role FROM utilisateurs'; // Sélectionne tous les rôles distincts
    pool.query(query, (err, results) => {
      if (err) {
        console.error(`Erreur lors de la récupération des rôles : ${err.message}`);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des rôles' });
      }
      const roles = results.map((result) => result.role);
      res.json(roles); // Renvoie la liste des rôles disponibles
    });
  });
  $allowedRoles = ['employé', 'vétérinaire'];
  if (!in_array($role, $allowedRoles)) {
    // Retourner une erreur ou une réponse indiquant que le rôle n'est pas valide
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



// Mettre un avis
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


// Gestion des avis dans la page admin
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
        const avis = result[0];
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



// Gestion des horaires
app.get('/horaires', (req, res) => {
    const query = 'SELECT * FROM Horaires';
  
    pool.query(query, (error, results) => {
      if (error) {
        console.error('Erreur lors de la récupération des horaires :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des horaires' });
      } else {
        res.status(200).json(results);
      }
    });
  });
// Mettre à jour un horaire
app.put('/horaires', (req, res) => {
    const modifiedHoraires = req.body;

    // Vérification que les données requises sont présentes et valides
    if (!modifiedHoraires || !Array.isArray(modifiedHoraires)) {
        return res.status(400).json({ message: 'Les horaires modifiés sont requis pour la mise à jour' });
    }

    // Utilisation d'une transaction pour garantir la cohérence des mises à jour
    pool.getConnection((err, connection) => {
        if (err) {
            console.error(`Erreur lors de la connexion à la base de données : ${err.message}`);
            return res.status(500).json({ message: 'Erreur serveur lors de la connexion à la base de données' });
        }

        connection.beginTransaction((err) => {
            if (err) {
                console.error(`Erreur lors du démarrage de la transaction : ${err.message}`);
                return res.status(500).json({ message: 'Erreur serveur lors du démarrage de la transaction' });
            }

            const updatePromises = modifiedHoraires.map((horaire) => {
                const { id, jour, heures } = horaire;
                const queryUpdate = 'UPDATE Horaires SET jour = ?, heures = ? WHERE id = ?';
                const values = [jour, heures, id];

                return new Promise((resolve, reject) => {
                    connection.query(queryUpdate, values, (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(result);
                    });
                });
            });

            Promise.all(updatePromises)
                .then(() => {
                    connection.commit((err) => {
                        if (err) {
                            console.error(`Erreur lors de la validation de la transaction : ${err.message}`);
                            return connection.rollback(() => {
                                res.status(500).json({ message: 'Erreur serveur lors de la validation de la transaction' });
                            });
                        }
                        res.json({ message: 'Horaires mis à jour avec succès' });
                    });
                })
                .catch((err) => {
                    console.error(`Erreur lors de la mise à jour des horaires : ${err.message}`);
                    connection.rollback(() => {
                        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour des horaires' });
                    });
                })
                .finally(() => {
                    connection.release();
                });
        });
    });
});



// Suppression d'un service + Image sur Bucket S3
async function deleteImageFromS3(imageUrl) {
    try {
        const key = imageUrl.split('/').pop(); // Récupère le nom du fichier depuis l'URL
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        };

        await s3.deleteObject(params).promise();
        console.log(`Image ${key} supprimée avec succès de S3`);
    } catch (err) {
        console.error(`Erreur lors de la suppression de l'image depuis S3 : ${err.message}`);
        throw err;
    }
}

function deleteImageFromS3(imageUrl) {
    return new Promise((resolve, reject) => {
        const decodedUrl = decodeURIComponent(imageUrl); // Décoder l'URL si nécessaire
        const key = decodedUrl.split('/').pop(); // Récupérer le nom du fichier à partir de l'URL

        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        };

        s3.deleteObject(params, (err, data) => {
            if (err) {
                console.error(`Erreur lors de la suppression de l'image de S3 : ${err.message}`);
                reject(err);
            } else {
                console.log(`Image ${key} supprimée de S3 avec succès`);
                resolve();
            }
        });
    });
}



// Partie gestion des services
app.get('/services/:id', async (req, res) => {
    const serviceId = req.params.id;
    try {
        const query = 'SELECT * FROM services WHERE id = ?';
        pool.query(query, [serviceId], (err, rows) => {
            if (err) {
                console.error(`Erreur lors de la récupération du service : ${err.message}`);
                return res.status(500).json({ error: 'Erreur serveur lors de la récupération du service' });
            }

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Service non trouvé' });
            }

            res.json(rows[0]);
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du service :', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du service' });
    }
});

// Récupération des services 
app.get('/services', (req, res) => {
    pool.query('SELECT * FROM services', (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des services :', err);
            res.status(500).json({ error: 'Erreur serveur lors de la récupération des services' });
        } else {
            // Ajuster chaque résultat pour inclure l'URL complète de l'image
            const servicesWithImageUrl = results.map(service => {
                return {
                    ...service,
                    image_url: service.image_url // Assurez-vous que service.image_url est déjà une URL complète
                };
            });
            res.json(servicesWithImageUrl);
        }
    });
});

  // Ajout d'un service
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
  app.put('/services/:id', upload.single('image_url'), async (req, res) => {
    const serviceID = req.params.id;
    const { title, description } = req.body;
    let imageUrl = req.file ? req.file.location : undefined; // URL de l'image dans S3 si une nouvelle image est téléchargée

    try {

        // Récupérer l'URL de l'image actuelle du service depuis la base de données
        const querySelect = 'SELECT image_url FROM services WHERE id = ?';
        pool.query(querySelect, [serviceID], async (err, rows) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                return res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'image' });
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Service non trouvé' });
            }

            const currentImageUrl = rows[0].image_url;

            // Supprimer l'ancienne image de S3 si une nouvelle image est téléchargée
            if (imageUrl && currentImageUrl) {
                try {
                    await deleteImageFromS3(currentImageUrl);
                } catch (error) {
                    console.error(`Erreur lors de la suppression de l'ancienne image de S3 : ${error.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'ancienne image de S3' });
                }
            }

            // Construction de la requête SQL pour mettre à jour le service
            const updateValues = [title, description];
            let queryUpdate = 'UPDATE services SET title = ?, description = ?';

            // Ajouter la nouvelle image à la requête SQL si imageUrl est défini
            if (imageUrl) {
                updateValues.push(imageUrl);
                queryUpdate += ', image_url = ?';
            }

            queryUpdate += ' WHERE id = ?';
            updateValues.push(serviceID);

            // Exécuter la requête SQL pour mettre à jour le service
            pool.query(queryUpdate, updateValues, (err, result) => {
                if (err) {
                    console.error(`Erreur lors de la mise à jour du service : ${err.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du service' });
                }

                // Vérifier si le service a été mis à jour avec succès
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'Service non trouvé' });
                }

                res.json({ message: 'Service mis à jour avec succès' });
            });
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du service :', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du service' });
    }
});

app.delete('/services/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Récupérer l'URL de l'image depuis la base de données
        const querySelect = 'SELECT image_url FROM services WHERE id = ?';
        pool.query(querySelect, [id], async (err, rows, fields) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                throw err;
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Service non trouvé' });
            }

            const imageUrl = rows[0].image_url;

            // Supprimer l'image depuis S3
            try {
                await deleteImageFromS3(imageUrl);

                // Supprimer le service depuis la base de données
                const queryDelete = 'DELETE FROM services WHERE id = ?';
                pool.query(queryDelete, [id], (err, result) => {
                    if (err) {
                        console.error(`Erreur lors de la suppression du service : ${err.message}`);
                        throw err;
                    }

                    console.log(`Service avec l'ID ${id} supprimé avec succès`);
                    res.status(200).json({ message: 'Service et image supprimés avec succès' });
                });
            } catch (error) {
                console.error(`Erreur lors de la suppression du service : ${error.message}`);
                res.status(500).json({ message: 'Erreur lors de la suppression du service' });
            }
        });
    } catch (error) {
        console.error(`Erreur lors de la suppression du service : ${error.message}`);
        res.status(500).json({ message: 'Erreur lors de la suppression du service' });
    }
});



// Partie gestion des animaux
app.post('/animals', upload.single('image'), async (req, res) => {
    const { name, species, age, description, habitat_id } = req.body;
    const imageUrl = req.file.location; // URL de l'image dans S3
  
    try {
      const query = 'INSERT INTO animals (name, species, age, description, habitat_id, image) VALUES (?, ?, ?, ?, ?, ?)';
      const result = await pool.query(query, [name, species, age, description, habitat_id, imageUrl]); // Ajoute animal_list à la liste des valeurs
  
      // Renvoie le nouvel habitat avec toutes les données insérées, y compris l'image et la liste d'animaux
      const insertedAnimal = {
        id: result.insertId,
        name,
        species,
        age,
        description,
        image: imageUrl,
        habitat_id,
      };
  
      res.status(201).json({ message: 'Animal ajouté avec succès', id: insertedAnimal });
    } catch (error) {
      console.error('Erreur lors de l\'insertion de l\'animal :', error);
      res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'animal' });
    }
  });
// Récupérer les détails d'un animal
app.get('/animals', (req, res) => {
    pool.query('SELECT animals.*, habitats.name AS habitat_name FROM animals LEFT JOIN habitats ON animals.habitat_id = habitats.id', (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des détails de l\'animal :', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération des détails de l\'animal' });
        } else {
            // Ajuster chaque résultat pour inclure l'URL complète de l'image
            const animalsWithImageUrl = results.map(animal => {
                return {
                    id: animal.id,
                    name: animal.name,
                    species: animal.species,
                    age: animal.age,
                    description: animal.description,
                    habitat_id: animal.habitat_id,
                    habitat_name: animal.habitat_name,
                    image: animal.image // Assurez-vous que cela correspond à votre structure de données
                };
            });
            res.json(animalsWithImageUrl);
        }
    });
});
// Supprimer un animal de la BDD et l'image de S3
async function deleteAnimalViews(animalId) {
    try {
      // Supprimez toutes les entrées dans MongoDB où animalId correspond
      const result = await AnimalView.deleteMany({ animalId: animalId.toString() });
      console.log(`Suppression des vues d'animal pour animalId ${animalId}: ${result.deletedCount} entrées supprimées.`);
    } catch (error) {
      console.error('Erreur lors de la suppression des vues d\'animal:', error);
      // Gérez l'erreur selon vos besoins
    }
  }

app.delete('/animals/:id', async (req, res) => {
    const { id } = req.params;
    const animalId = req.params.id;
    try {
        // Récupérer l'URL de l'image depuis la base de données
        const querySelect = 'SELECT image FROM animals WHERE id = ?';
        pool.query(querySelect, [id], async (err, rows, fields) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                throw err;
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Service non trouvé' });
            }

            const imageUrl = rows[0].image;
  
            try {
                await deleteImageFromS3(imageUrl);
                await deleteAnimalViews(animalId);

                // Supprimer le service depuis la base de données
                const queryDelete = 'DELETE FROM animals WHERE id = ?';
                pool.query(queryDelete, [id], (err, result) => {
                    if (err) {
                        console.error(`Erreur lors de la suppression de lanimal : ${err.message}`);
                        throw err;
                    }

                    console.log(`Animal avec l'ID ${id} supprimé avec succès`);
                    res.status(200).json({ message: 'Animal et image supprimés avec succès' });
                });
            } catch (error) {
                console.error(`Erreur lors de la suppression de lanimal : ${error.message}`);
                res.status(500).json({ message: 'Erreur lors de la suppression du lanimal' });
            }
        });
    } catch (error) {
        console.error(`Erreur lors de la suppression de lanimal : ${error.message}`);
        res.status(500).json({ message: 'Erreur lors de la suppression de lanimal' });
    }
});
//Modifier un Animal
app.put('/animals/:id', upload.single('image'), async (req, res) => {
    const animalId = req.params.id;
    const { name, species, age, description, habitat_id } = req.body;
    let imageUrl = req.file ? req.file.location : undefined; // URL de l'image dans S3 si une nouvelle image est téléchargée

    try {
        // Vérifier s'il y a des enregistrements vétérinaires associés à cet animal
        const checkQuery = 'SELECT COUNT(*) AS count FROM vetrecords WHERE animal_id = ?';
        const { count } = await pool.query(checkQuery, [animalId]);

        if (count > 0) {
            // Si des enregistrements vétérinaires existent, retourner une erreur 409
            return res.status(409).json({ error: 'Cet animal est associé à des enregistrements vétérinaires et ne peut pas être modifié pour le moment.' });
        }

        // Récupérer l'URL de l'image actuelle de l'animal depuis la base de données
        const querySelect = 'SELECT image FROM animals WHERE id = ?';
        pool.query(querySelect, [animalId], async (err, rows) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                return res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'image' });
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Animal non trouvé' });
            }

            const currentImageUrl = rows[0].image;

            // Supprimer l'ancienne image de S3 si une nouvelle image est téléchargée
            if (imageUrl && currentImageUrl) {
                try {
                    await deleteImageFromS3(currentImageUrl);
                } catch (error) {
                    console.error(`Erreur lors de la suppression de l'ancienne image de S3 : ${error.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'ancienne image de S3' });
                }
            }

            // Construction de la requête SQL pour mettre à jour l'animal
            const updateValues = [name, species, age, description, habitat_id];
            let queryUpdate = 'UPDATE animals SET name = ?, species = ?, age = ?, description = ?, habitat_id = ?';

            // Ajouter la nouvelle image à la requête SQL si imageUrl est défini
            if (imageUrl) {
                updateValues.push(imageUrl);
                queryUpdate += ', image = ?';
            }

            queryUpdate += ' WHERE id = ?';
            updateValues.push(animalId);

            // Exécuter la requête SQL pour mettre à jour l'animal
            pool.query(queryUpdate, updateValues, (err, result) => {
                if (err) {
                    console.error(`Erreur lors de la mise à jour de l'animal : ${err.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'animal' });
                }

                // Vérifier si l'animal a été mis à jour avec succès
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'Animal non trouvé' });
                }

                res.json({ message: 'Animal mis à jour avec succès' });
            });
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'animal :', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'animal' });
    }
});
  

//Gestion des habitats
app.get('/habitats', (req, res) => { 
    pool.query('SELECT * FROM habitats', (err, result) => {
        if (err) {
            console.error('Erreur lors de la récupération des habitats :', err);
            res.status(500).json({ error: 'Erreur serveur lors de la récupération des habitats' });
        } else {
            // Ajuster chaque résultat pour inclure l'URL complète de l'image
            const habitatsWithImageUrl = result.map(habitat => {
                return {
                    ...habitat,
                    image: habitat.image // Assurez-vous que habitat.image est déjà une URL complète
                };
            });
            res.json(habitatsWithImageUrl);
        }
    });
});

// Affichage habitats par id
app.get('/habitats/:id', (req, res) => {
    const habitatId = req.params.id;
    pool.query('SELECT * FROM habitats WHERE id = ?', habitatId, (err, result) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'habitat :', err);
            res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'habitat' });
        } else if (result.length === 0) {
            res.status(404).json({ error: 'Habitat non trouvé' });
        } else {
            const habitat = result[0];
            // Ajuster l'image si nécessaire comme indiqué précédemment
            res.json(habitat);
        }
    });
});

// Créer un nouvel habitat
app.post('/habitats', upload.single('image'), async (req, res) => {
    const { name, description, animal_list } = req.body;
    const imageUrl = req.file.location; // URL de l'image dans S3
  
    try {
      const query = 'INSERT INTO habitats (name, description, image, animal_list) VALUES (?, ?, ?, ?)';
      const result = await pool.query(query, [name, description, imageUrl, animal_list]); // Ajoute animal_list à la liste des valeurs
  
      // Renvoie le nouvel habitat avec toutes les données insérées, y compris l'image et la liste d'animaux
      const insertedHabitat = {
        id: result.insertId,
        name,
        description,
        image: imageUrl,
        animal_list,
      };
  
      res.status(201).json({ message: 'Habitat ajouté avec succès', habitat: insertedHabitat });
    } catch (error) {
      console.error('Erreur lors de l\'insertion de l\'habitat :', error);
      res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'habitat' });
    }
  });

// Mettre à jour un habitat
app.put('/habitats/:id', upload.single('image'), async (req, res) => {
    const habitatId = req.params.id;
    const { name, description, animal_list } = req.body;
    let imageUrl = req.file ? req.file.location : undefined; // URL de la nouvelle image dans S3

    try {
        // Récupérer l'URL de l'image actuelle de l'habitat depuis la base de données
        const querySelect = 'SELECT image FROM habitats WHERE id = ?';
        pool.query(querySelect, [habitatId], async (err, rows) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                return res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'image' });
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Habitat non trouvé' });
            }

            const currentImageUrl = rows[0].image;

            // Supprimer l'ancienne image de S3 si une nouvelle image est téléchargée
            if (imageUrl && currentImageUrl) {
                try {
                    await deleteImageFromS3(currentImageUrl);
                } catch (error) {
                    console.error(`Erreur lors de la suppression de l'ancienne image de S3 : ${error.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'ancienne image de S3' });
                }
            }

            // Construction de la requête SQL pour mettre à jour l'habitat
            const updateValues = [name, description, animal_list];
            let queryUpdate = 'UPDATE habitats SET name = ?, description = ?, animal_list = ?';

            // Ajouter la nouvelle image à la requête SQL si imageUrl est défini
            if (imageUrl) {
                updateValues.push(imageUrl);
                queryUpdate += ', image = ?';
            }

            queryUpdate += ' WHERE id = ?';
            updateValues.push(habitatId);

            // Exécuter la requête SQL pour mettre à jour l'habitat
            pool.query(queryUpdate, updateValues, (err, result) => {
                if (err) {
                    console.error(`Erreur lors de la mise à jour de l'habitat : ${err.message}`);
                    return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'habitat' });
                }

                // Vérifier si l'habitat a été mis à jour avec succès
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'Habitat non trouvé' });
                }

                res.json({ message: 'Habitat mis à jour avec succès' });
            });
        });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'habitat : ${error.message}`);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'habitat' });
    }
});


// Supprimer un habitat
app.delete('/habitats/:id', (req, res) => {
    const { id } = req.params;

    try {
        // Récupérer l'URL de l'image depuis la base de données
        const querySelect = 'SELECT image FROM habitats WHERE id = ?';
        pool.query(querySelect, [id], async (err, rows, fields) => {
            if (err) {
                console.error(`Erreur lors de la sélection de l'image : ${err.message}`);
                throw err;
            }

            // Vérifier si aucune entrée n'est trouvée
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Service non trouvé' });
            }

            const imageUrl = rows[0].image;

            // Supprimer l'image depuis S3
            try {
                await deleteImageFromS3(imageUrl);

                // Supprimer le service depuis la base de données
                const queryDelete = 'DELETE FROM habitats WHERE id = ?';
                pool.query(queryDelete, [id], (err, result) => {
                    if (err) {
                        console.error(`Erreur lors de la suppression de lhabitat : ${err.message}`);
                        throw err;
                    }

                    console.log(`Habitat avec l'ID ${id} supprimé avec succès`);
                    res.status(200).json({ message: 'Habitat et image supprimés avec succès' });
                });
            } catch (error) {
                console.error(`Erreur lors de la suppression de lhabitat : ${error.message}`);
                res.status(500).json({ message: 'Erreur lors de la suppression du lhabitat' });
            }
        });
    } catch (error) {
        console.error(`Erreur lors de la suppression de lhabitat : ${error.message}`);
        res.status(500).json({ message: 'Erreur lors de la suppression de lhabitat' });
    }
});

// Récupération Animal + Affichage des données vétérinaires
app.get('/animals/:id', (req, res) => {
    const animalId = req.params.id;
    const animalQuery = 'SELECT * FROM animals WHERE id = ?';
    const vetRecordsQuery = 'SELECT * FROM vetrecords WHERE animal_id = ?';
  
    pool.query(animalQuery, [animalId], (err, animalResults) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des détails de l\'animal' });
      }
  
      if (animalResults.length === 0) {
        return res.status(404).json({ error: 'Animal non trouvé' });
      }
  
      pool.query(vetRecordsQuery, [animalId], (err, vetRecordsResults) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur lors de la récupération des enregistrements vétérinaires' });
        }
  
        const animal = animalResults[0];
        animal.vetRecords = vetRecordsResults;
        res.json(animal);
      });
    });
  });


// Affichage des données vétérinaires
app.get('/vetrecords/:id', (req, res) => {
    const vetRecordId = req.params.id;
  
    // Exemple avec utilisation de pool.query pour interagir avec la base de données
    pool.query('SELECT * FROM vetrecords WHERE id = ?', [vetRecordId], (err, results) => {
      if (err) {
        console.error('Erreur lors de la récupération des détails de l\'enregistrement vétérinaire :', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des détails de l\'enregistrement vétérinaire' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ error: 'Enregistrement vétérinaire non trouvé' });
      }
  
      res.json(results[0]);
    });
  });
//Ajout de données vétérinaires 
app.post('/vetrecords', (req, res) => {
    const { animal_id, health_status, food, food_amount, visit_date, visit_time, details } = req.body;
  
    if (!animal_id || !health_status || !food || !food_amount || !visit_date) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
  
    const insertQuery = 'INSERT INTO vetrecords (animal_id, health_status, food, food_amount, visit_date, visit_time, details) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [animal_id, health_status, food, food_amount, visit_date, visit_time, details];
  
    pool.query(insertQuery, values, (err, results) => {
      if (err) {
        console.error('Erreur lors de l\'insertion de l\'enregistrement vétérinaire :', err);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion de l\'enregistrement vétérinaire' });
      }
  
      const insertedId = results.insertId;
      res.status(201).json({ id: insertedId, message: 'Enregistrement vétérinaire ajouté avec succès' });
    });
  });
//Mettre a jour des données vétérinaires
  app.put('/vetrecords/:id', (req, res) => {
    const vetRecordId = req.params.id;
    const { health_status, food, food_amount, visit_date, details } = req.body;
  
    // Validation des données requises
    if (!health_status || !food || !food_amount || !visit_date) {
      return res.status(400).json({ error: 'Tous les champs doivent être remplis' });
    }
  
    // Update query
    const updateQuery = `UPDATE vetrecords SET health_status = ?, food = ?, food_amount = ?, visit_date = ?, details = ? WHERE id = ?`;
  
    // Execute the query
    pool.query(updateQuery, [health_status, food, food_amount, visit_date, details, vetRecordId], (error, results) => {
      if (error) {
        console.error('Erreur lors de la mise à jour des données vétérinaires :', error);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour des données vétérinaires' });
      }
  
      res.status(200).json({ message: 'Données vétérinaires mises à jour avec succès' });
    });
  });
  app.delete('/vetrecords/:id', (req, res) => {
    const vetRecordId = req.params.id;

    const deleteQuery = 'DELETE FROM vetrecords WHERE id = ?';

    pool.query(deleteQuery, [vetRecordId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la suppression de l\'enregistrement vétérinaire :', err);
            return res.status(500).json({ error: 'Erreur lors de la suppression de l\'enregistrement vétérinaire' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Enregistrement vétérinaire non trouvé' });
        }

        res.json({ message: 'Enregistrement vétérinaire supprimé avec succès' });
    });
});

app.get('/animals', async (req, res) => {
    try {
      const animalId = req.params.id;
      // Remplacez cette logique par votre propre méthode pour récupérer le nom de l'animal depuis la base de données
      const animal = await Animal.findById(animalId);
      if (!animal) {
        return res.status(404).json({ message: 'Animal not found' });
      }
      res.json({ id: animal.id, name: animal.name });
    } catch (error) {
      console.error('Error fetching animal name:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

app.get('/animalviews', async (req, res) => {
    try {
      const animalViews = await AnimalView.find({});
      res.json(animalViews);
    } catch (error) {
      console.error('Error fetching animal views:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

let requestLock = {};

app.post('/animalviews', async (req, res) => {
  const { animalId, animalName } = req.body;

  if (!animalId || isNaN(animalId)) {
    console.error('Invalid animalId:', animalId);
    return res.status(400).send('Invalid animalId');
  }

  // Verrou pour éviter les requêtes multiples
  if (requestLock[animalId]) {
    return res.status(429).send('Too many requests, please try again later.');
  }
  requestLock[animalId] = true;

  try {
    let animalView = await AnimalView.findOne({ animalId: animalId.toString() });

    if (animalView) {
      animalView.viewCount += 1;
      animalView.animalName = animalName; 
      await animalView.save();
    } else {
      await new AnimalView({ animalId: animalId.toString(), animalName, viewCount: 1 }).save();
    }

    res.status(200).send('Consultation incrémentée avec succès');
  } catch (error) {
    console.error('Error incrementing consultations:', error);
    res.status(500).send('Internal server error');
  } finally {
    // Retirer le verrou après un délai court
    setTimeout(() => { delete requestLock[animalId]; }, 1000);
  }
});


mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000
  }).then(() => console.log('Connected to MongoDB with Mongoose'))
    .catch(err => console.error('Error connecting to MongoDB with Mongoose:', err));

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});