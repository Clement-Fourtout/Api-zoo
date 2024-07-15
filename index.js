
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
var MongoClient = require('mongodb').MongoClient;

// Middleware pour parser le JSON
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
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
});

var username = process.env.MONGODB_USERNAME;
var password = process.env.MONGODB_PASSWORD;
var hosts = process.env.MONGODB_HOSTS;
var database = process.env.MONGODB_DATABASE;
var options = process.env.MONGODB_OPTIONS;
var connectionString = `mongodb://${username}:${password}@${hosts}/${database}${options}`;

MongoClient.connect(connectionString, function(err, db) {
    if (db) {
        db.close();
    }
    if (err) {
        console.log('Error: ', err);
    } else {
        console.log('Connected!');
        process.exit();
    }
});

const AnimalViews = mongoose.model('AnimalViews', new mongoose.Schema({
        animalId: String,
        consultations: Number
    }, { collection: 'vues des animaux' }));


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
// Fonction pour supprimer une image de S3
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



// Ajouter un animal
app.post('/animals', upload.single('image'), async (req, res) => {
    const { name, species, age, habitat_id } = req.body;
    const imageUrl = req.file.location; // URL de l'image dans S3
  
    try {
      const query = 'INSERT INTO animals (name, species, age, habitat_id, image) VALUES (?, ?, ?, ?, ?)';
      const result = await pool.query(query, [name, species, age, habitat_id, imageUrl]); // Ajoute animal_list à la liste des valeurs
  
      // Renvoie le nouvel habitat avec toutes les données insérées, y compris l'image et la liste d'animaux
      const insertedAnimal = {
        id: result.insertId,
        name,
        species,
        age,
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
                    habitat_id: animal.habitat_id,
                    habitat_name: animal.habitat_name,
                    image: animal.image // Assurez-vous que cela correspond à votre structure de données
                };
            });
            res.json(animalsWithImageUrl);
        }
    });
});

app.delete('/animals/:id', async (req, res) => {
    const { id } = req.params;
  
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
router.put('/habitats/:id', (req, res) => {
    const habitatId = req.params.id;
    const { name, description, image, animal_list } = req.body;
    const sql = 'UPDATE Habitats SET name=?, description=?, image=?, animal_list=? WHERE id=?';
    db.query(sql, [name, description, image, animal_list, habitatId], (err, result) => {
        if (err) {
            console.error('Error updating habitat:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.send('Habitat updated successfully');
    });
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
    const { animal_id, health_status, food, food_amount, visit_date, details } = req.body;
  
    if (!animal_id || !health_status || !food || !food_amount || !visit_date) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
  
    const insertQuery = 'INSERT INTO vetrecords (animal_id, health_status, food, food_amount, visit_date, details) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [animal_id, health_status, food, food_amount, visit_date, details];
  
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

// Incrémenter le compteur de consultation
app.post('/animals/:id/consultations', async (req, res) => {
    const animalId = req.params.id;
  
    try {
      // Logique pour récupérer l'animal avec l'ID spécifié depuis la base de données
      const animal = await Animal.findById(animalId); // Supposons que vous utilisez un modèle Animal
  
      if (!animal) {
        return res.status(404).json({ error: 'Animal non trouvé' });
      }
  
      // Incrémenter le nombre de consultations
      animal.consultations = animal.consultations ? animal.consultations + 1 : 1; // Incrémente ou initialise à 1 si null
  
      // Sauvegarder les modifications dans la base de données
      await animal.save();
  
      // Répondre avec succès
      res.status(200).json({ message: 'Consultations incrémentées avec succès', animal });
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation des consultations :', error);
      res.status(500).json({ error: 'Erreur serveur lors de l\'incrémentation des consultations' });
    }
  });
  
// Route pour obtenir les statistiques
app.get('/animals/stats', async (req, res) => {
    try {
      // Récupérer tous les animaux avec le nombre de consultations depuis la base de données
      const animals = await Animal.find({}, { consultations: 1 });
  
      // Calculer le total des consultations pour tous les animaux
      const totalConsultations = animals.reduce((acc, animal) => acc + animal.consultations, 0);
  
      // Répondre avec les statistiques des animaux
      res.json({ totalConsultations, animals });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques des animaux :', error);
      res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques des animaux' });
    }
  });

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});