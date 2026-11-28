// Legal documents, French version (binding). DRAFTS: must be reviewed by a lawyer before publication.
// Tokens {{path|label}} are replaced at build time with the value from src/config/business.mjs.
// If the value is null, the build shows a highlighted "[À COMPLÉTER : label]" and production build refuses to run.

export default {
  mentions: {
    title: 'Mentions légales',
    description: 'Mentions légales du site AINA Évidence : éditeur, directeur de la publication et hébergeur.',
    sections: [
      { h: 'Éditeur du site', items: [
        'Dénomination : {{legal.legalName|dénomination}}',
        'Forme juridique : {{legal.legalForm|forme juridique}}',
        'Numéro SIREN : {{legal.siren|SIREN}}',
        'Immatriculation : Répertoire national des entreprises (RNE)',
        'TVA : {{legal.vatNumber|numéro de TVA ou mention de franchise en base}}',
        'Adresse : {{legal.address|adresse}}',
        'Contact : {{contact.email|e-mail}} — {{contact.phone|téléphone}}',
        'Professionnel : {{owner.displayName|nom}}, {{owner.qualification|qualification}}',
      ] },
      { h: 'Directeur de la publication', paras: ['{{legal.publicationDirector|directeur de la publication}}'] },
      { h: 'Hébergement', paras: ['{{legal.hostProvider|nom, adresse et contact de l’hébergeur}}'] },
      { h: 'Propriété intellectuelle', paras: ['Les textes, guides, visuels et la structure du site sont protégés par le droit d’auteur. Toute reproduction sans autorisation écrite est interdite. Les guides téléchargés sont destinés à un usage personnel et ne peuvent être revendus ni diffusés.'] },
      { h: 'Médiation de la consommation', paras: ['Conformément au Code de la consommation, le consommateur peut recourir gratuitement à un médiateur : {{legal.mediator|médiateur, adresse et site}}.'] },
      { h: 'Nature des services', paras: ['Les services proposés sur ce site sont de nature éducative et de conseil. Ils ne constituent ni un diagnostic médical, ni un traitement, ni une prescription. En cas de maladie, consultez un professionnel de santé.'] },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    description: 'Comment AINA Évidence collecte et traite vos données personnelles, conformément au RGPD.',
    sections: [
      { h: 'Responsable du traitement', paras: ['{{legal.legalName|dénomination}}, {{legal.address|adresse}}. Contact : {{contact.email|e-mail}}.'] },
      { h: 'Données collectées', paras: ['Via le formulaire de contact : nom, e-mail, téléphone ou messagerie (facultatif), sujet de la demande, message (facultatif, 500 caractères maximum). Via la boutique : e-mail, éléments de commande, informations de facturation transmises par le prestataire de paiement.', 'Le formulaire n’est pas destiné à recueillir des données de santé. Ne transmettez pas d’analyses ni de diagnostics. Si de telles données sont transmises, elles sont supprimées dès que possible.'] },
      { h: 'Finalités et bases légales', items: [
        'Répondre à votre demande et organiser une consultation : votre consentement (article 6.1.a du RGPD).',
        'Envoyer un produit numérique acheté et la facture : exécution du contrat (article 6.1.b).',
        'Respecter les obligations comptables et fiscales : obligation légale (article 6.1.c).',
      ] },
      { h: 'Destinataires', paras: ['Les données sont accessibles au responsable du traitement. Elles peuvent être transmises à l’hébergeur du site, au service de messagerie utilisé pour répondre aux demandes et, pour les paiements, au prestataire de paiement Revolut ({{business.paymentProviderEntity|entité Revolut contractante}}), qui traite les données de paiement sous sa propre responsabilité. Aucune donnée n’est vendue.'] },
      { h: 'Transferts hors Union européenne', paras: ['Si un prestataire est situé hors de l’Union européenne, un encadrement conforme au RGPD est mis en place. {{policy.transfers|précisez les prestataires situés hors UE, ou indiquez qu’il n’y en a pas}}.'] },
      { h: 'Durée de conservation', paras: ['Les demandes de contact sont conservées {{policy.retentionMonths|nombre de mois}} mois après le dernier échange.', 'Les documents comptables et justificatifs de facturation sont conservés 10 ans (article L123-22 du Code de commerce).', 'Les données utilisées pour la prospection commerciale sont conservées 3 ans après le dernier contact (recommandations de la CNIL).'] },
      { h: 'Vos droits', paras: ['Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité, ainsi que du droit de retirer votre consentement à tout moment, sans effet sur les traitements antérieurs. Pour exercer vos droits : {{contact.email|e-mail}}.', 'Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).'] },
      { h: 'Sécurité', paras: ['Le site utilise le protocole HTTPS. Les données sont stockées sur un serveur à accès restreint. Les fichiers numériques sont accessibles uniquement par un lien personnel à durée limitée.'] },
      { h: 'Mineurs', paras: ['Les consultations sur l’alimentation de l’enfant sont demandées par un parent ou un représentant légal, qui transmet les données pour son enfant.'] },
      { h: 'Cookies', paras: ['Voir la page « Cookies ».'] },
      { h: 'Mise à jour', paras: ['La présente politique peut être mise à jour. La version en vigueur est celle publiée sur cette page.'] },
    ],
  },
  terms: {
    title: 'Conditions générales de vente',
    description: 'Conditions générales de vente des consultations et des produits numériques AINA Évidence.',
    sections: [
      { h: '1. Objet', paras: ['Les présentes conditions régissent la vente, en ligne, des consultations et des produits numériques proposés par {{legal.legalName|dénomination}} (ci-après « le Vendeur »). Toute commande implique l’acceptation de ces conditions.'] },
      { h: '2. Informations précontractuelles', paras: ['Les caractéristiques essentielles de chaque service et produit sont décrites sur le site, avant la commande. Les prix sont indiqués en euros, toutes taxes comprises, selon les mentions de chaque page.'] },
      { h: '3. Consultations', paras: ['Les consultations sont fournies en ligne à la date convenue après confirmation par e-mail. Une demande via le formulaire n’est pas une réservation. Le contenu est éducatif et ne remplace pas un avis médical.'] },
      { h: '4. Produits numériques', paras: ['Les produits numériques (guides au format PDF) sont fournis par téléchargement après confirmation du paiement, par un lien personnel. Le lien est valable {{download.validityDays|durée en jours}} jours et permet {{download.maxDownloads|nombre}} téléchargements au maximum.'] },
      { h: '5. Paiement', paras: ['Le paiement s’effectue en ligne sur la page sécurisée du prestataire de paiement Revolut ({{business.paymentProviderEntity|entité Revolut contractante}}). Moyens de paiement : {{business.paymentMethods|moyens de paiement proposés}}. La commande n’est validée qu’après confirmation du paiement par le prestataire. Le montant payé est celui affiché au moment de la commande.'] },
      { h: '6. Droit de rétractation', paras: ['Pour les contrats conclus à distance, le consommateur dispose en principe d’un délai de quatorze jours pour se rétracter, sans motif (article L221-18 du Code de la consommation).', 'Pour les produits numériques non fournis sur support matériel, le droit de rétractation ne peut être exercé lorsque l’exécution a commencé après l’accord préalable exprès du consommateur et sa renonciation expresse à ce droit (article L221-28 du Code de la consommation). Cette renonciation est recueillie au moment de la commande par une case à cocher.', 'Pour les consultations, si vous demandez que la prestation commence avant la fin du délai de rétractation, vous devez le demander expressément ; vous ne payez alors que la partie déjà fournie si vous vous rétractez (article L221-25).'] },
      { h: '7. Garantie de conformité', paras: ['Le Vendeur est tenu de la garantie légale de conformité (articles L217-1 et suivants du Code de la consommation) et de la garantie des vices cachés. Un fichier non conforme ou inaccessible vous est remplacé ou restitué.'] },
      { h: '8. Responsabilité', paras: ['Les conseils donnés ont une vocation éducative. Le Vendeur ne peut être tenu responsable des conséquences d’une application non adaptée à votre état de santé ou d’une décision prise sans avis médical. Cette limitation ne s’applique pas aux dommages qui ne peuvent pas être exclus par la loi.'] },
      { h: '9. Médiation', paras: ['En cas de litige, vous pouvez recourir gratuitement au médiateur suivant : {{legal.mediator|médiateur, adresse et site}}.'] },
      { h: '10. Droit applicable et juridiction', paras: ['Les présentes conditions sont soumises au {{policy.governingLaw|droit applicable}}. Pour un consommateur, les règles impératives de son pays de résidence restent applicables. Juridiction compétente : {{policy.courtLocation|tribunal compétent}}.'] },
      { h: '11. Contact', paras: ['{{contact.email|e-mail}} — {{contact.phone|téléphone}}'] },
    ],
  },
  refunds: {
    title: 'Politique de remboursement',
    description: 'Conditions d’annulation, de report et de remboursement des consultations et des produits numériques.',
    sections: [
      { h: 'Consultations', items: [
        'Annulation ou report : possible en écrivant à {{contact.email|e-mail}} au moins {{policy.refundWindowHours|nombre}} heures avant le rendez-vous. Dans ce délai, nous proposons un report gratuit ou un remboursement intégral, au choix du client. Ces options ne limitent pas vos droits légaux.',
        'En cas d’annulation dans ce délai : remboursement intégral, sous {{policy.refundDays|nombre}} jours, par le même moyen de paiement.',
        'En cas d’annulation tardive ou d’absence : {{policy.lateCancellation|condition appliquée}}.',
      ] },
      { h: 'Produits numériques', paras: ['Un guide non encore téléchargé peut être remboursé dans les conditions de la section « Droit de rétractation » des conditions générales de vente. Une fois le fichier fourni et la renonciation acceptée, aucun remboursement n’est dû, sauf fichier non conforme ou inaccessible par la faute du Vendeur. Dans ce cas, nous proposons un nouveau lien ou un remboursement.'] },
      { h: 'Remboursement technique', paras: ['En cas de double paiement ou d’erreur technique, un remboursement intégral est effectué sans condition.'] },
    ],
  },
  digital: {
    title: 'Règles de vente des produits numériques',
    description: 'Conditions d’accès, de téléchargement et d’usage des guides numériques.',
    sections: [
      { h: 'Nature du produit', paras: ['Les guides sont des fichiers PDF à vocation éducative. Ils ne remplacent pas une consultation médicale et ne contiennent pas de prescription.'] },
      { h: 'Accès et téléchargement', items: [
        'Le lien de téléchargement est envoyé par e-mail après confirmation du paiement.',
        'Validité du lien : {{download.validityDays|nombre}} jours. Nombre de téléchargements : {{download.maxDownloads|nombre}} maximum.',
        'Si vous n’avez pas reçu le lien, vérifiez vos spams puis écrivez-nous. Un nouveau lien peut être émis.',
      ] },
      { h: 'Usage', paras: ['Usage strictement personnel. Le fichier ne peut être ni revendu, ni partagé, ni publié, ni traduit pour une diffusion publique sans accord écrit.'] },
      { h: 'Droit de rétractation', paras: ['Voir les conditions générales de vente, article 6 : une fois le contenu fourni après votre accord exprès et votre renonciation, le droit de rétractation ne s’applique pas.'] },
      { h: 'Conformité', paras: ['Si le fichier est défectueux ou illisible, signalez-le sous 14 jours : il sera remplacé ou remboursé.'] },
    ],
  },
  cookies: {
    title: 'Cookies',
    description: 'Cookies et stockage local utilisés par le site AINA Évidence.',
    sections: [
      { h: 'Ce que nous utilisons', paras: ['Le site n’utilise aucun cookie publicitaire ni cookie de mesure d’audience. Le site enregistre uniquement ce qui est strictement nécessaire à son fonctionnement : le contenu de votre panier dans le stockage local de votre navigateur.'] },
      { h: 'Consentement', paras: ['Les éléments strictement nécessaires au service demandé ne nécessitent pas de consentement préalable (recommandations de la CNIL). Si des outils de mesure d’audience ou de publicité sont ajoutés, un bandeau de consentement sera mis en place avant tout dépôt.'] },
      { h: 'Gérer vos choix', paras: ['Vous pouvez effacer le panier et les données du site à tout moment dans les paramètres de votre navigateur.'] },
    ],
  },
};
