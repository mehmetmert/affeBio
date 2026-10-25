/* ============================================================================
   affeBio — MODÜL 1 VERİ KATMANI: Gerçek BodyParts3D Anatomi Veri Seti
   Kaynak: BodyParts3D 4.0 (The Database Center for Life Science, Japonya)
   Lisans: CC BY 4.0 — https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
   2.234 ayrı mesh, 3.432 adlandırılmış FMA kavramı. Bu dosya, veri setinin
   15 vücut sistemi rengi/açıklaması (Türkçe) ve ~200 yapının İngilizce kaynak
   açıklama sözlüğünü içerir (slorksmo/Human-Atlas projesinden, MIT lisanslı
   kod + CC BY 4.0 veri; adaptasyon bu proje için yeniden yazılmıştır).
   ============================================================================ */
(function () {
  'use strict';

  // Atlas verisindeki 15 sistem — renkler kaynak projedeki ile aynı korunmuştur.
  const ANAT_SYSTEMS = [
    { id: 'skeletal', name: 'İskelet Sistemi', color: '#e2d9ba', description: 'Kemikler vücudun taşıyıcı iskeletini oluşturur, organları korur ve kasların tutunma noktalarını sağlar. İç dokuları mineral depolar ve kan hücreleri üretir.' },
    { id: 'muscular', name: 'Kas Sistemi', color: '#a85b50', description: 'İskelet kasları, tutunma noktalarını çekerek hareket üretir. Tendonlarla birlikte eklemleri hareket ettirir, duruşu sabitler ve ısı üretir.' },
    { id: 'cardiac', name: 'Kalp', color: '#b96760', description: 'Kalp, dört odacıklı kaslı bir pompadır. Kapakçıkları kanı pulmoner ve sistemik dolaşım boyunca ileri yönde yönlendirir.' },
    { id: 'sensory', name: 'Duyu Organları', color: '#b0c8ce', description: 'Görme, işitme ve denge gibi özel duyulara katkıda bulunan yapılardır. Özelleşmiş dokuları uyaranları algılar ve sinir sistemiyle birlikte çalışır.' },
    { id: 'arterial', name: 'Atardamarlar', color: '#c05245', description: 'Kalp, kanı dolaşım boyunca pompalar. Atardamarlar kanı kalpten dokulara, pulmoner dolaşımda ise akciğerlere taşır.' },
    { id: 'venous', name: 'Toplardamarlar', color: '#527c9f', description: 'Toplardamarlar kanı kalbe geri döndürür. Yüzeysel ve derin ağlar dokulardan kan toplar; pulmoner venler akciğerlerden oksijenli kanı geri getirir.' },
    { id: 'nervous', name: 'Sinir Sistemi', color: '#d8b565', description: 'Beyin, omurilik ve çevresel sinirler sinyalleri taşır ve işler. Duyu, hareket, koordinasyon ve vücut fonksiyonlarının otomatik düzenlenmesini destekler.' },
    { id: 'respiratory', name: 'Solunum Sistemi', color: '#b98991', description: 'Hava yolları havayı akciğerlere iletir; burada oksijen ve karbondioksit hava ile kan arasında değişir. Soluma, solunum kaslarının oluşturduğu basınç değişimlerine bağlıdır.' },
    { id: 'digestive', name: 'Sindirim Sistemi', color: '#b8916b', description: 'Sindirim kanalı besinleri parçalar, besin ve suyu emer, atığı ileri taşır. Yardımcı organlar safra ve sindirim enzimleri sağlar.' },
    { id: 'urinary', name: 'Boşaltım Sistemi', color: '#b47961', description: 'Böbrekler kanı filtreler, sıvı/elektrolit/asit-baz dengesini düzenler. İdrar üreterler yoluyla mesaneye ulaşır ve üretradan atılır.' },
    { id: 'lymphatic', name: 'Lenfatik Sistem', color: '#879f7c', description: 'Lenf damarları fazla doku sıvısını dolaşıma geri döndürür. Lenf düğümleri ve diğer lenfoid organlar bağışıklık gözetimini destekler.' },
    { id: 'endocrine', name: 'Endokrin Sistem', color: '#c5a09a', description: 'Endokrin organlar, metabolizma, büyüme, stres yanıtları ve üreme gibi süreçleri koordine etmek için kana hormon salgılar.' },
    { id: 'reproductive', name: 'Üreme Sistemi', color: '#bda098', description: 'Burada gösterilen üreme yapıları gamet ve seks hormonu üretir, bunları taşıyan kanalları sağlar.' },
    { id: 'integumentary', name: 'Vücut Yüzeyi (Deri)', color: '#ba9b7d', description: 'Vücut yüzeyi, dıştan bir anatomik referans sağlar. Deri sistemi koruyucu bir bariyer oluşturur, dokunma ve sıcaklık düzenlemesine katkıda bulunur.' },
    { id: 'connective', name: 'Bağ Dokusu', color: '#aec3bb', description: 'Kıkırdak, bağlar ve diğer bağ dokuları yapıları destekler, birbirine bağlar ve ayırır. Eklemleri sabitlemek ve mekanik yükleri dağıtmak bunlardan biridir.' }
  ];

  // Kaynak: slorksmo/Human-Atlas app/anatomy.ts — BodyParts3D 4.0 açıklama sözlüğü (İngilizce, orijinal metin).
  const EXPLANATIONS = {
    'heart': 'A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.',
    'liver': 'A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.',
    'brain': 'The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.',
    'stomach': 'A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.',
    'spleen': 'A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.',
    'pancreas': 'An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.',
    'urinary bladder': 'A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.',
    'trachea': 'The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.',
    'diaphragm': 'A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.',
    'kidney': 'A paired organ in the back of the abdomen. It filters blood, adjusts fluid and electrolyte balance, and drains urine through the renal pelvis into the ureter.',
    'lungs': 'The paired organs of gas exchange. Air reaching their smallest airspaces passes oxygen into the blood and takes up carbon dioxide.',
    'spinal cord': 'The cord of nervous tissue running inside the vertebral canal. It carries signals between the brain and the body and organizes local reflexes.',
    'thymus': 'A lymphoid organ behind the sternum. It is where developing T lymphocytes mature, and it is largest in childhood.',
    'lymph node': 'A small filtering organ on the lymphatic vessels. Lymph passing through it is surveyed by immune cells gathered in its follicles and paracortex.',
    'skin': 'The outer covering of the body. It forms a protective barrier, senses touch and temperature, and helps regulate heat and water loss.',
    'gluteus maximus': 'The largest muscle of the buttock. It straightens the hip and is what drives standing up, climbing, and running.',
    'gluteus medius': 'A fan-shaped hip muscle that holds the pelvis level when the opposite foot leaves the ground.',
    'gluteus minimus': 'The deepest of the three gluteal muscles, working with gluteus medius to steady the pelvis in walking.',
    'psoas major': 'A deep muscle running from the lumbar spine to the femur. It is the main flexor of the hip.',
    'iliacus': 'A fan of muscle lining the inside of the ilium. With psoas it flexes the hip and steadies the pelvis.',
    'tensor fasciae latae': 'A small hip muscle that tightens the iliotibial band down the outside of the thigh.',
    'piriformis': 'A deep muscle from the sacrum to the top of the femur, turning the thigh outward. The sciatic nerve passes beside it.',
    'rectus femoris': 'The only part of the quadriceps that crosses the hip as well as the knee: it flexes the hip and straightens the knee.',
    'vastus lateralis': 'The largest head of the quadriceps, on the outer thigh, straightening the knee.',
    'vastus medialis': 'The inner head of the quadriceps, whose lower fibres help hold the kneecap in its groove.',
    'vastus intermedius': 'The head of the quadriceps lying directly on the front of the femur, beneath the other three.',
    'sartorius': 'The longest muscle in the body, running across the thigh from the hip bone to the inner side of the knee.',
    'gracilis': 'A strap-like muscle down the inner thigh, drawing the leg inward and helping bend the knee.',
    'adductor longus': 'The most forward of the adductors, drawing the thigh towards the midline.',
    'adductor magnus': 'The largest adductor, spanning from the pelvis to nearly the whole length of the femur.',
    'semitendinosus': 'A hamstring with a long cord-like tendon, bending the knee and extending the hip.',
    'semimembranosus': 'The deepest hamstring, broad and flat above, bending the knee and extending the hip.',
    'gastrocnemius medial': 'The inner head of the calf muscle, crossing both knee and ankle to point the foot down.',
    'gastrocnemius lateral': 'The outer head of the calf muscle, working with the medial head through the Achilles tendon.',
    'soleus': 'The broad flat muscle beneath gastrocnemius. It points the foot down and holds the body upright when standing.',
    'tibialis anterior': 'The muscle on the front of the shin that lifts the foot, keeping the toes clear as the leg swings through.',
    'frontal bone': 'The bone of the forehead. It forms the front of the cranial vault and the roofs of the eye sockets.',
    'parietal bone': 'One of the paired bones forming the top and sides of the cranial vault.',
    'temporal bone': 'The bone at the side of the skull. It houses the middle and inner ear and carries the joint for the jaw.',
    'occipital bone': 'The bone at the back and base of the skull. Its large opening lets the brainstem pass into the spinal canal.',
    'sphenoid bone': 'The wing-shaped bone at the base of the skull. It cradles the pituitary gland and forms part of each eye socket.',
    'maxilla': 'The upper jaw bone. It carries the upper teeth and forms the floor of the eye socket and much of the hard palate.',
    'mandible': 'The lower jaw, the only freely moving bone of the skull. It carries the lower teeth and hinges at the temporal bone.',
    'zygomatic bone': 'The cheekbone. It shapes the prominence of the cheek and the outer rim of the eye socket.',
    'hyoid bone': 'A U-shaped bone in the neck that touches no other bone. Slung from muscles and ligaments, it anchors the tongue and the larynx.',
    'rib': 'One of the curved bones of the chest wall. Ribs run from the thoracic spine towards the sternum, shielding the heart and lungs and moving with each breath.',
    'costal cartilage': 'The bar of cartilage joining a rib to the sternum. Its springiness lets the chest wall expand during breathing.',
    'clavicle': 'The collarbone. It props the shoulder out from the trunk and is the only bony link between the arm and the chest.',
    'scapula': 'The shoulder blade. It glides across the back of the ribcage and carries the socket for the head of the humerus.',
    'humerus': 'The bone of the upper arm, running from the shoulder socket to the elbow.',
    'radius': 'The forearm bone on the thumb side. It rotates around the ulna to turn the palm up and down.',
    'ulna': 'The forearm bone on the little-finger side. Its upper end forms the hinge of the elbow.',
    'calcaneus': 'The heel bone, the largest bone of the foot. It takes the first impact of each step and anchors the Achilles tendon.',
    'talus': 'The bone linking the foot to the leg. It carries the whole weight of the body down into the heel and the arch of the foot.',
    'descending aorta': 'The length of aorta running down through the chest and abdomen, giving off the branches that supply the trunk and legs.',
    'ascending aorta': 'The first stretch of the aorta, leaving the left ventricle. The coronary arteries arise from its root.',
    'tongue': 'A muscular organ in the mouth. It moves food for chewing and swallowing, carries the taste buds, and shapes the sounds of speech.',
    'mouth': 'The first part of the digestive tract. Its lips, palate, teeth, and tongue take in food, begin breaking it down, and shape the sounds of speech.',
    'hard palate': 'The bony front part of the roof of the mouth. It gives the tongue a firm surface to press food against.',
    'soft palate': 'The muscular back part of the roof of the mouth. It lifts during swallowing to close off the nasal cavity.',
    'gingiva': 'The gum. It covers the bone around the teeth and seals the join between tooth and jaw.',
    'parotid gland': 'The largest salivary gland, in front of and below the ear. Its duct opens into the cheek beside the upper molars.',
    'submandibular gland': 'A salivary gland below the floor of the mouth. It supplies much of the saliva produced at rest.',
    'sublingual gland': 'The smallest major salivary gland, lying under the tongue and draining through several short ducts.',
    'colon': 'The long stretch of large intestine that absorbs water and salts from what the small intestine passes on, and forms and stores stool.',
    'small intestine': 'The long coiled tube between the stomach and the colon. Most digestion is completed and most nutrients absorbed along its lining.',
    'duodenum': 'The first, C-shaped part of the small intestine. It receives stomach contents along with bile and pancreatic enzymes.',
    'jejunum': 'The middle part of the small intestine. Its densely folded lining absorbs the bulk of digested nutrients.',
    'ileum': 'The last part of the small intestine. It absorbs bile salts and vitamin B12 before emptying into the caecum.',
    'caecum': 'The pouch at the start of the large intestine. It receives the contents of the ileum and carries the vermiform appendix.',
    'vermiform appendix': 'A narrow blind tube attached to the caecum. It holds lymphoid tissue and has no essential digestive role.',
    'rectum': 'The final straight section of the large intestine, where stool is held before it is passed.',
    'sigmoid colon': 'The S-shaped length of colon between the descending colon and the rectum.',
    'common bile duct': 'The duct formed where the cystic and common hepatic ducts meet. It delivers bile into the duodenum.',
    'gallbladder': 'A small sac beneath the liver. It concentrates and stores bile, then releases it after a meal.',
    'renal pelvis': 'The funnel where the calyces of the kidney join. It collects urine and passes it into the ureter.',
    'ureter': 'The muscular tube carrying urine from the kidney to the bladder. Waves of contraction move urine along it.',
    'renal medulla': 'The inner part of the kidney, made of the renal pyramids. Its tubules build the salt gradient that concentrates urine.',
    'larynx': 'The voice box, between the throat and the trachea. Its cartilages hold the airway open and its vocal folds produce sound.',
    'bronchi': 'The branching airways beyond the trachea. They carry air into and out of the lungs, warming and cleaning it on the way.',
    'cricoid cartilage': 'The only complete ring of cartilage in the airway, sitting just below the thyroid cartilage.',
    'thyroid cartilage': 'The largest cartilage of the larynx. Its two plates meet at the front of the neck and support the vocal folds behind them.',
    'eye': 'The organ of sight. Light passes through the cornea and lens to be focused on the retina, which turns it into nerve signals.',
    'retina': 'The light-sensitive layer lining the back of the eye. Its photoreceptors convert light into signals carried out along the optic nerve.',
    'cornea': 'The clear front window of the eye. Its curvature does most of the focusing before light reaches the lens.',
    'lens': 'The transparent body behind the iris. Changing its shape shifts focus between near and distant objects.',
    'iris': 'The coloured ring of muscle around the pupil. It widens and narrows the pupil to control how much light enters.',
    'sclera': 'The tough white outer coat of the eyeball. It holds the eye in shape and anchors the eye muscles.',
    'ciliary body': 'The ring of tissue behind the iris. Its muscle changes the shape of the lens, and it produces the aqueous humour.',
    'vitreous humor': 'The clear gel filling the eye behind the lens. It holds the retina against the back of the eye.',
    'cardiac chamber': 'The four chambers of the heart: two atria that receive blood and two ventricles that pump it out.',
    'left ventricle': 'The thick-walled chamber that pumps oxygenated blood into the aorta and out to the body.',
    'right ventricle': 'The chamber that pumps blood into the pulmonary trunk and on to the lungs.',
    'left cardiac atrium': 'The chamber receiving oxygenated blood from the pulmonary veins and passing it to the left ventricle.',
    'right cardiac atrium': 'The chamber receiving returning blood from the venae cavae and passing it to the right ventricle.',
    'interventricular septum': 'The muscular wall between the two ventricles, keeping oxygenated and deoxygenated blood apart.',
    'aortic valve': 'The valve between the left ventricle and the aorta. It opens to let blood out and closes to stop it running back.',
    'mitral valve': 'The two-leaflet valve between the left atrium and the left ventricle.',
    'tricuspid valve': 'The three-leaflet valve between the right atrium and the right ventricle.',
    'pulmonary valve': 'The valve between the right ventricle and the pulmonary trunk.',
    'aorta': 'The largest artery. It leaves the left ventricle and gives off the branches that supply the whole body.',
    'aortic arch': 'The curve of the aorta above the heart. Its branches supply the head, neck, and arms.',
    'superior vena cava': 'The large vein returning blood from the head, neck, and arms to the right atrium.',
    'inferior vena cava': 'The large vein returning blood from the abdomen, pelvis, and legs to the right atrium.',
    'hepatic portal vein': 'The vein carrying nutrient-rich blood from the intestines and spleen into the liver.',
    'pulmonary trunk': 'The vessel leaving the right ventricle. It divides into the left and right pulmonary arteries.',
    'celiac trunk': 'A short artery from the abdominal aorta supplying the stomach, liver, and spleen.',
    'superior mesenteric artery': 'The artery supplying the small intestine and the first part of the colon.',
    'palatine tonsil': 'A mass of lymphoid tissue on each side of the throat, sampling what is swallowed and breathed in.',
    'vertebra': 'One bone of the spinal column. Its body carries weight and its arch encloses the spinal cord.',
    'sacrum': 'The triangular bone formed from fused vertebrae. It wedges between the hip bones and passes the weight of the spine into the pelvis.',
    'coccyx': 'The tailbone at the base of the spine, formed from small fused rudimentary vertebrae.',
    'pelvis': 'The ring of bone made by the hip bones, sacrum, and coccyx. It carries the weight of the trunk and, in the female, surrounds the birth canal.',
    'ilium': 'The broad fan-shaped upper part of the hip bone. Its blade anchors the hip and abdominal muscles.',
    'ischium': 'The lower back part of the hip bone. Its tuberosity is what the body rests on when seated.',
    'pubis': 'The front part of the hip bone. The two pubic bones meet at the pubic symphysis.',
    'femur': 'The thigh bone, the longest in the body. Its head sits in the hip socket and its condyles form the upper half of the knee.',
    'tibia': 'The shin bone. It carries almost all the weight passing from the knee down to the ankle.',
    'fibula': 'The slender bone beside the tibia. It carries little weight but steadies the ankle and anchors muscles.',
    'patella': 'The kneecap. It rides in the quadriceps tendon and improves the leverage of that muscle as the knee straightens.',
    'knee joint': 'The hinge between the femur and the tibia. Cartilage, menisci, and ligaments let it bend and straighten while bearing weight.',
    'intervertebral disk': 'The pad between two vertebral bodies. A tough outer ring and a soft centre absorb load and let the spine bend.',
    'meniscus': 'A C-shaped wedge of cartilage in the knee. It deepens the joint surface and spreads load across it.',
    'optic nerve': 'The nerve carrying visual signals from the retina back to the brain.',
    'optic chiasm': 'The crossing where fibres from the inner half of each retina pass to the opposite side of the brain.',
    'dura mater': 'The tough outer membrane enclosing the brain and spinal cord.',
    'brain hemisphere': 'One half of the cerebrum. Its cortex and deep nuclei handle sensation, movement, and thought largely for the opposite side of the body.',
    'hippocampus': 'A curved structure in the temporal lobe, essential for forming new memories and for finding your way through space.',
    'thalamus': 'A pair of deep nuclei that relay almost all sensory and motor signals on their way to the cortex.',
    'hypothalamus': 'A small region under the thalamus. It regulates temperature, hunger, thirst, sleep, and the hormone output of the pituitary.',
    'corpus callosum': 'The broad band of fibres joining the two cerebral hemispheres and carrying traffic between them.',
    'amygdaloid complex': 'A group of nuclei in the temporal lobe involved in emotion, especially fear, and in emotional memory.',
    'olfactory bulb': 'The forward extension of the brain that receives input from the nose and begins the processing of smell.',
    'sternum': 'The flat bone at the front of the chest. Its manubrium, body, and xiphoid process anchor the clavicles and the costal cartilages of the ribs.',
    'vertebral column': 'The stack of vertebrae running from the neck to the pelvis. It carries the weight of the trunk, allows the spine to bend, and encloses the spinal cord.',
    'omentum': 'A fold of peritoneum hanging from the stomach over the abdominal organs. It stores fat and helps wall off infection and injury.',
    'testis': 'The paired male gonad. It produces sperm and testosterone.',
    'prostate': 'A gland below the bladder surrounding the start of the urethra. It adds fluid to semen.',
    'penis': 'The male organ carrying the urethra, through which urine and semen leave the body.',
    'seminal vesicle': 'A paired gland behind the bladder adding fluid to semen.',
    'epididymis': 'The coiled tube beside each testis where sperm matures and is stored.',
    'vas deferens': 'The muscular tube carrying mature sperm from the epididymis toward the urethra.',
    'thyroid gland': 'A butterfly-shaped gland in the neck. It releases hormones that set the pace of metabolism throughout the body.',
    'adrenal gland': 'A small gland on top of each kidney. Its outer and inner regions release different hormones, including cortisol and adrenaline.',
    'pituitary gland': 'A pea-sized gland beneath the brain. It releases hormones that control growth and direct several other endocrine glands.'
  };

  const KEYS_BY_LENGTH = Object.keys(EXPLANATIONS).sort((a, b) => b.length - a.length);

  // Kaynak isimler yan belirtimi farklı yazar: "left kidney", "Descending aorta a".
  // Bunları temizleyerek aynı yapının her kopyası için tek açıklama kullanılır.
  function sharedName(name) {
    return name
      .replace(/\s*\((?:left|right)\)\s*$/i, '')
      .replace(/^(?:left|right)\s+/i, '')
      .replace(/\s+[a-z]$/, '')
      .trim();
  }

  function qualifiedKey(name) {
    return KEYS_BY_LENGTH.find((key) => name.startsWith(key + ' ') || name.endsWith(' ' + key));
  }

  function explanationFor(name, systemId) {
    const key = (name || '').toLowerCase().trim();
    const base = sharedName(key);
    const text = EXPLANATIONS[key] || EXPLANATIONS[base] || EXPLANATIONS[qualifiedKey(base) || ''];
    if (text) return text;
    const sys = ANAT_SYSTEMS.find((s) => s.id === systemId);
    return sys ? sys.description : '';
  }

  const ATTRIBUTION_EN = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.';
  const ATTRIBUTION_URL = 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html';
  const ATTRIBUTION_TR = 'Bu modül, 2.234 gerçek anatomik mesh ve 3.432 adlandırılmış yapı içeren BodyParts3D 4.0 veri setini kullanır (yetişkin erkek referans anatomisi, MRI ve anatomik atlas verilerinden üretilmiştir). CC BY 4.0 lisansı ile dağıtılmıştır.';

  window.AnatomyData = {
    SYSTEMS: ANAT_SYSTEMS,
    EXPLANATIONS,
    explanationFor,
    sharedName,
    ATTRIBUTION_EN,
    ATTRIBUTION_URL,
    ATTRIBUTION_TR
  };
})();
