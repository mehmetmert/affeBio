/* ============================================================================
   affeBio — MODÜL 2 VERİSİ: Hücre Galerisi (7 hücre tipi)
   Veri modeli cclank/cell-architecture-studio (MIT) projesinden uyarlanıp
   Türkçeye çevrilmiştir. "model" alanı olan hücreler gerçekçi bir 3B GLB
   modeliyle de gösterilir (kaynak/lisans bilgisi her modelin "credit"
   alanında ve models/cells/ATTRIBUTION.md dosyasındadır). "pins" koordinatları
   modelin merkezlenip en uzun kenarı 5 birime ölçeklenmiş uzayındadır:
   [x, y, z, nx, ny, nz] (yüzey noktası + yüzey normali).
   realOnly: true olan organeller yalnızca gerçekçi modelde görünür.
   ============================================================================ */
(function () {
  'use strict';

  const CELLS = [
    {
      id: 'plant', name: 'Bitki Hücresi', type: 'Ökaryotik Hücre', accent: '#4f8a3f', shape: 'plant',
      occurrence: 'Yapraklar, gövdeler, kökler — güneş ışığını şekere çeviren, su taşıyan ve enerji depolayan dokular oluşturur.',
      clinical: 'İnsan dışı temel bir örnek: hasta doku örneklerinde hücre duvarı ve kloroplast neden bulunmadığını göstermek için kullanılır.',
      defaultOrganelle: 'nucleus',
      model: {
        url: 'models/cells/plant-cell.glb', textured: true,
        credit: 'Model: cclank/cell-architecture-studio (MIT) — Tripo ile üretilmiş "first001" bitki hücresi; affeBio için sadeleştirildi (~1,9 M → ~97 B üçgen).',
        pins: {
          nucleus: [0.429, 1.121, -0.198, 0.166, 0.254, 0.953],
          chloro: [-0.191, 1.5, 0.877, 0.67, 0.204, 0.714],
          vacuole: [0.659, 0.083, 0.769, 0.851, 0.304, 0.428],
          wall: [-0.468, 1.995, 1.19, 0.441, 0.886, 0.142],
          mito: [0.101, 0.784, 1.52, 0.765, 0.64, 0.071],
          golgi: [0.821, -0.286, -0.579, 0.903, 0.418, 0.103]
        }
      },
      organelles: [
        { key: 'nucleus', name: 'Çekirdek', subtitle: 'Komuta merkezi', color: '#7047a8', count: 1, r: 0.8,
          attrs: [['Boyut', '5–10 µm çap'], ['Konum', 'Genelde kenara itilmiş'], ['Işık mikroskobunda görünür', 'Evet']],
          note: 'Çekirdek, moleküler trafiği düzenleyen porlara sahip çift katlı bir zar olan çekirdek zarfıyla çevrilidir. Olgun bitki hücrelerinde büyük koful onu kenara iter.',
          fact: 'Çekirdek, keşfedilen ilk hücre yapılarından biriydi (Robert Brown, 1831 — orkide hücrelerinde).' },
        { key: 'chloro', name: 'Kloroplast', subtitle: 'Işık hasatçısı', color: '#5fa842', count: 5, r: 0.36,
          attrs: [['Görev', 'Fotosentez'], ['Pigment', 'Klorofil'], ['İç yapı', 'Tilakoit / grana yığınları']],
          note: 'Kloroplastlar ışık enerjisini kimyasal enerjiye çevirir ve birçok bitki dokusuna yeşil rengini verir. İçlerindeki madeni para yığınlarına benzeyen yapılara grana denir.',
          fact: 'Tek bir yaprak hücresi onlarca kloroplast içerebilir; kendi DNA\'ları vardır.' },
        { key: 'vacuole', name: 'Merkezi Koful', subtitle: 'Basınç rezervuarı', color: '#62bdd2', count: 1, r: 1.05,
          attrs: [['Hacim', 'Hücrenin %30–80\'i'], ['İçerik', 'Su ve çözünenler'], ['İşlev', 'Turgor desteği']],
          note: 'Merkezi koful su, iyon ve küçük molekülleri depolarken bitki hücresinin sertliğini (turgor) korumasına yardımcı olur.',
          fact: 'Bitki susuz kalınca koful küçülür ve yapraklar pörsür.' },
        { key: 'wall', name: 'Hücre Duvarı', subtitle: 'Sert çerçeve', color: '#a3b84a', count: 1, r: 1.55,
          attrs: [['Malzeme', 'Selüloz ağırlıklı'], ['Konum', 'Zarın dışı'], ['İşlev', 'Şekil ve koruma']],
          note: 'Hücre duvarı bitki hücrelerine düzenli şeklini verir ve altındaki zarı korur. Komşu hücreler arasındaki geçitlere plazmodezma denir.',
          fact: 'Hücre duvarları bitkilerin iskeletsiz dik durmasını sağlar.' },
        { key: 'mito', name: 'Mitokondri', subtitle: 'Enerji santrali', color: '#cf6f42', count: 3, r: 0.24,
          attrs: [['Uzunluk', '1–10 µm'], ['Zar', 'Çift'], ['Görev', 'ATP üretimi']],
          note: 'Bitki hücreleri de mitokondri içerir: kloroplastların ürettiği şeker, mitokondride hücresel solunumla ATP\'ye çevrilir.',
          fact: 'Kloroplast ve mitokondri birlikte çalışarak bitkinin gece-gündüz enerji dengesini sağlar.' },
        { key: 'golgi', name: 'Golgi Aygıtı', subtitle: 'Paketleme istasyonu', color: '#d49057', count: 1, r: 0.42,
          attrs: [['Şekil', 'Yassı kese yığını'], ['Görev', 'Duvar polisakkaritleri'], ['Konum', 'Sitoplazma']],
          note: 'Bitkilerde Golgi aygıtı proteinleri paketlemenin yanı sıra hücre duvarı için selüloz dışı polisakkaritleri (pektin, hemiselüloz) üretir.',
          fact: 'Bölünen bitki hücrelerinde Golgi kesecikleri birleşerek yeni hücre plağını oluşturur.' }
      ]
    },
    {
      id: 'animal', name: 'Hayvan Hücresi', type: 'Ökaryotik Hücre', accent: '#9b74b7', shape: 'animal',
      occurrence: 'Hayvan dokuları — zarlar, iç organeller ve özelleşmiş sinyal yapılarıyla esnek dokular oluşturur.',
      clinical: 'Öğrencilerin insan dokularına ve hastalık mekanizmalarına geçmeden önce organel işlevlerini oturttuğu genel ökaryotik model.',
      defaultOrganelle: 'nucleus',
      organelles: [
        { key: 'nucleus', name: 'Çekirdek', subtitle: 'Komuta odası', color: '#7a49b0', count: 1, r: 0.95,
          attrs: [['Şekil', 'Yuvarlak'], ['Zar', 'Çift, porlu'], ['İçinde', 'Çekirdekçik (nükleolus)']],
          note: 'Çekirdek kromozomları depolar ve bir hücrede hangi genlerin aktif olduğunu düzenler. İçindeki koyu çekirdekçikte ribozom alt birimleri üretilir.',
          fact: 'Tüm hayvan hücreleri çekirdeğini korumaz — olgun alyuvarlar çekirdeğini kaybeder.' },
        { key: 'mito', name: 'Mitokondri', subtitle: 'Enerji dönüştürücü', color: '#cf6f42', count: 6, r: 0.3,
          attrs: [['Uzunluk', '1–10 µm'], ['Zar', 'Çift (iç zar kıvrımlı)'], ['Görev', 'ATP üretimi']],
          note: 'Mitokondriler, krista adı verilen katlanmış iç zarları aracılığıyla yakıt moleküllerini kullanılabilir hücresel enerjiye (ATP) dönüştürür.',
          fact: 'Mitokondrilerin kendine ait küçük bir DNA genomu vardır ve anneden kalıtılır.' },
        { key: 'er', name: 'Endoplazmik Retikulum', subtitle: 'Zar kanalları ağı', color: '#4fa3d8', count: 1, r: 0.78,
          attrs: [['Tür', 'Granüllü / düz'], ['İşlev', 'Protein ve lipit sentezi'], ['Konum', 'Çekirdek çevresi']],
          note: 'Granüllü ER (üzerinde ribozomlar) protein, düz ER ise lipit sentezler; ikisi birlikte geniş bir zar kanalları ağı oluşturur.',
          fact: 'ER, çekirdek zarfıyla doğrudan bağlantılıdır.' },
        { key: 'golgi', name: 'Golgi Aygıtı', subtitle: 'Paketleme istasyonu', color: '#d49057', count: 1, r: 0.48,
          attrs: [['Şekil', 'Yassı kese yığınları'], ['İşlev', 'Değiştirme ve sıralama'], ['Konum', 'Çekirdeğe yakın']],
          note: 'Golgi aygıtı ER\'den gelen proteinleri ve lipitleri değiştirir, sıralar ve keseciklerle hedeflerine gönderir.',
          fact: 'Salgı yapan hücrelerde (ör. pankreas) genellikle belirgin bir Golgi aygıtı bulunur.' },
        { key: 'ribosome', name: 'Ribozom', subtitle: 'Protein fabrikası', color: '#3fe0b0', count: 60, r: 0.04,
          attrs: [['Boyut', '~25 nm'], ['Konum', 'Sitoplazma / ER üzeri'], ['İşlev', 'Protein sentezi']],
          note: 'Ribozomlar mRNA\'daki genetik şifreyi okuyup amino asitleri birleştirerek protein üretir.',
          fact: 'Bir hücrede milyonlarca ribozom bulunabilir.' },
        { key: 'lysosome', name: 'Lizozom', subtitle: 'Temizlik kesesi', color: '#e0566b', count: 5, r: 0.13,
          attrs: [['Boyut', '~1 µm'], ['İçerik', 'Sindirim enzimleri'], ['pH', '~4,5 (asidik)']],
          note: 'Lizozomlar hücre içi atıkları ve yaşlanmış organelleri asidik ortamdaki sindirim enzimleriyle parçalar.',
          fact: 'Lizozom enzimlerinin eksikliği Tay-Sachs gibi depo hastalıklarına yol açar.' },
        { key: 'centriole', name: 'Sentriyol', subtitle: 'Bölünme organizatörü', color: '#e8c95a', count: 1, r: 0.12,
          attrs: [['Yapı', '9 üçlü mikrotübül'], ['Konum', 'Çekirdek yanı (sentrozom)'], ['Görev', 'İğ iplikleri']],
          note: 'Birbirine dik iki sentriyol sentrozomu oluşturur; hücre bölünmesi sırasında kromozomları ayıran iğ ipliklerinin düzenlenmesine yardım eder.',
          fact: 'Bitki hücrelerinin çoğunda sentriyol bulunmaz.' }
      ]
    },
    {
      id: 'whiteBlood', name: 'Akyuvar (Beyaz Kan Hücresi)', type: 'Bağışıklık Hücresi', accent: '#6d78a8', shape: 'whiteBlood',
      occurrence: 'Kan, lenf, dokular — tehditleri tanımlamak ve bağışıklık savunmasını koordine etmek için kan ve doku boşluklarında hareket eder.',
      clinical: 'Enfeksiyon, enflamasyon ve kan yayması yorumlamasını temel hücre biyolojisine bağlayan bir köprüdür.',
      defaultOrganelle: 'nucleus',
      model: {
        url: 'models/cells/white-blood-cell.glb', textured: true,
        credit: 'Model: cclank/cell-architecture-studio (MIT) — Tripo ile üretilmiş akyuvar GLB; affeBio için sadeleştirildi (~1,9 M → ~95 B üçgen).',
        pins: {
          nucleus: [1.461, 1.05, 0.595, 0.324, 0.423, 0.846],
          granule: [0.943, 0.311, 0.571, 0.995, -0.079, 0.056],
          lysosome: [1.079, 0.097, 1.121, 0.632, 0.538, 0.557],
          mito: [0.958, -0.596, 0.921, 0.616, 0.547, -0.567],
          pseudopod: [0.938, -1.518, 2.084, 0.375, 0.915, 0.15]
        }
      },
      organelles: [
        { key: 'nucleus', name: 'Loblu Çekirdek', subtitle: 'Esnek genom kasası', color: '#6f35a1', count: 1, r: 0.62,
          attrs: [['Şekil', 'Çok loblu'], ['Konum', 'Merkezi'], ['Işık mikroskobunda görünür', 'Boyama ile evet']],
          note: 'Birçok akyuvarın (ör. nötrofil) 2–5 loblu bir çekirdeği vardır; bu, dar aralıklardan sıkışarak geçmelerine yardımcı olur.',
          fact: 'Çekirdek şekli, kan yaymasında akyuvar tipini belirlemede kullanılan ipuçlarından biridir.' },
        { key: 'granule', name: 'Granüller', subtitle: 'Kimyasal paketler', color: '#c06696', count: 24, r: 0.07,
          attrs: [['İçerik', 'Enzim ve antimikrobiyal proteinler'], ['Kullanım', 'Savunma'], ['Görünürlük', 'Boyamaya bağlı']],
          note: 'Granüller, bağışıklık hücrelerinin enfeksiyona veya enflamasyona hızla yanıt vermesini sağlayan molekülleri depolar.',
          fact: 'Nötrofil, eozinofil ve bazofil adları granüllerinin boyanma biçiminden gelir.' },
        { key: 'lysosome', name: 'Lizozom', subtitle: 'Sindirim kesesi', color: '#8b54b7', count: 6, r: 0.12,
          attrs: [['Boyut', '~1 µm'], ['İçerik', 'Sindirim enzimleri'], ['Görev', 'Yutulanı parçalama']],
          note: 'Lizozomlar, fagozomla birleşerek akyuvarın yuttuğu bakterileri sindirir ve yıpranmış bileşenleri geri dönüştürür.',
          fact: 'Yutulan bir bakteri dakikalar içinde fagolizozomda parçalanabilir.' },
        { key: 'mito', name: 'Mitokondri', subtitle: 'Enerji kaynağı', color: '#cf6f42', count: 3, r: 0.16,
          attrs: [['Sayı', 'Görece az'], ['Görev', 'ATP üretimi'], ['Önemi', 'Göç ve fagositoz']],
          note: 'Akyuvarlar dokulara göç etmek ve mikropları yutmak için enerjiye ihtiyaç duyar; mitokondriler bu enerjinin ve bazı sinyallerin kaynağıdır.',
          fact: 'Nötrofiller enerjinin büyük kısmını glikolizden karşılar.' },
        { key: 'pseudopod', name: 'Yalancı Ayak (Psödopod)', subtitle: 'Yakalama kolu', color: '#c9d3ea', count: 1, r: 0.2,
          attrs: [['Yapı', 'Zar uzantısı'], ['İskelet', 'Aktin filamentleri'], ['Görev', 'Hareket ve fagositoz']],
          note: 'Akyuvar, aktin iskeletini yeniden düzenleyerek zarından uzantılar çıkarır; bu yalancı ayaklarla hem hareket eder hem de bakterileri sarıp yutar (fagositoz).',
          fact: 'Akyuvarlar damar duvarındaki hücrelerin arasından sıkışarak dokuya geçebilir (diapedez).' }
      ]
    },
    {
      id: 'neuron', name: 'Nöron', type: 'Sinir Hücresi', accent: '#6578b5', shape: 'neuron',
      occurrence: 'Beyin, omurilik, sinirler — uzun dallanan ağlar boyunca elektriksel ve kimyasal sinyaller taşır.',
      clinical: 'Nöron şekli, hücre yapısını refleksler, duyu ve motor sinyalleşme gibi klinik nöroanatomiyle ilişkilendirmeye yardımcı olur.',
      defaultOrganelle: 'soma',
      model: {
        url: 'models/cells/neuron.glb', textured: false,
        shade: { mode: 'radial', centerPin: 'soma', radius: 3.4, stops: [[0, '#b38af0'], [0.12, '#8f6fe0'], [0.35, '#7d9bcf'], [1, '#4fb3c8']] },
        credit: 'Model: "Neuron" — destacados tv, NIH 3D (3DPX-015796), CC BY-NC-SA 4.0. Yüzey normalleri yeniden hesaplandı, sıkıştırıldı ve renklendirildi.',
        pins: {
          soma: [0.06, 1.326, 0.065, -0.027, 0.035, 0.999],
          dendrite: [-0.668, 1.823, -0.018, 0.018, 0.144, 0.989],
          axon: [0.121, -0.58, 0.044, 0.038, -0.714, 0.699],
          terminal: [-0.949, -1.971, -0.03, 0.012, 0.013, 1]
        }
      },
      organelles: [
        { key: 'soma', name: 'Soma (Hücre Gövdesi)', subtitle: 'Hücre gövdesi', color: '#7c52b7', count: 1, r: 0.85,
          attrs: [['İçerik', 'Çekirdek, Nissl cisimcikleri'], ['Görev', 'Metabolik merkez'], ['Şekil', 'Yuvarlak / piramidal']],
          note: 'Soma nöronu idame ettirir ve dallanan dendritlerden gelen sinyalleri bütünleştirir; akson tepeciğinde eşik aşılırsa aksiyon potansiyeli başlar.',
          fact: 'Çoğu nöron proteini soma içinde veya yakınında üretilir.' },
        { key: 'dendrite', name: 'Dendritler', subtitle: 'Alıcı dallar', color: '#7d9bcf', count: 1, r: 0.07,
          attrs: [['Şekil', 'Dallanmış'], ['Görev', 'Girdi'], ['Yüzey', 'Sıklıkla dikenli']],
          note: 'Dendritler diğer hücrelerden sinyal almak için kullanılabilir yüzey alanını artırır.',
          fact: 'Tek bir nöron binlerce sinaptik girdi alabilir.' },
        { key: 'axon', name: 'Akson', subtitle: 'Sinyal otoyolu', color: '#6b7dc6', count: 1, r: 0.12,
          attrs: [['Uzunluk', 'µm ile 1 metreden uzun'], ['Yalıtım', 'Miyelin kını'], ['Hız', '100 m/s\'ye kadar']],
          note: 'Vücuttaki bazı aksonlar omurgadan ayağa kadar uzanır; miyelin kını sinyalin Ranvier boğumları arasında atlayarak hızlı ilerlemesini sağlar.',
          fact: 'Bir sinir impulsu saniyede 100 metreden hızlı yol alabilir.' },
        { key: 'terminal', name: 'Akson Uçları', subtitle: 'Sinaps düğmeleri', color: '#4fb3c8', count: 1, r: 0.06,
          attrs: [['İçerik', 'Sinaptik kesecikler'], ['Görev', 'Nörotransmitter salımı'], ['Bağlantı', 'Sinaps']],
          note: 'Akson ucu dallanarak sinaptik düğmeler oluşturur; burada elektrik sinyali kimyasal nörotransmitter salımına dönüşür.',
          fact: 'Bir sinaptik iletim yaklaşık 0,5 milisaniyede tamamlanır.' }
      ]
    },
    {
      id: 'epithelial', name: 'Epitel Hücresi', type: 'İnsan Doku Hücresi', accent: '#a56d7f', shape: 'epithelial',
      occurrence: 'Deri, bağırsak, hava yolları — vücut genelinde koruyucu tabakalar ve emilim yüzeyleri oluşturur.',
      clinical: 'Epitel polaritesi ve sıkı bağlantılar bu hücre tipini bariyerler, emilim ve patoloji preparatı yorumlamasında merkezi kılar.',
      defaultOrganelle: 'microvilli',
      model: {
        url: 'models/cells/epithelial-cell.glb', textured: true,
        credit: 'Model: huangserva/3DCellForge (MIT) — Tripo ile üretilmiş epitel hücresi GLB; affeBio için sadeleştirildi (~1,9 M → ~97 B üçgen).',
        pins: {
          microvilli: [0.66, 2.093, 0.964, -0.351, 0.669, 0.655],
          nucleus: [1.105, 0.136, 0.234, 0.212, 0.345, 0.914],
          mito: [1.037, 0.214, 1.723, 0.934, -0.065, 0.352],
          golgi: [1.108, -0.843, -0.548, 0.993, 0.103, 0.057],
          junction: [-0.236, 1.503, 2.347, 0.992, 0.112, -0.062]
        }
      },
      organelles: [
        { key: 'microvilli', name: 'Mikrovillus', subtitle: 'Emilim fırçası', color: '#c86f80', count: 1, r: 0.05,
          attrs: [['Uzunluk', '0,5–1 µm'], ['Konum', 'Apikal yüzey'], ['Görev', 'Yüzey alanı']],
          note: 'Mikrovilluslar, epitel tabakaları boyunca emilim ve salgılama için yüzey alanını artırır.',
          fact: 'Bağırsak mikrovillusları yoğun bir "fırça kenarı" oluşturur ve yüzeyi ~20 kat büyütür.' },
        { key: 'junction', name: 'Sıkı Bağlantılar', subtitle: 'Mühürlü dikişler', color: '#9f6cbd', count: 1, r: 0.05,
          attrs: [['Konum', 'Apikal yan kenarlar'], ['Görev', 'Bariyer'], ['Görünürlük', 'EM tercih edilir']],
          note: 'Sıkı bağlantılar komşu epitel hücrelerini birbirine bağlar ve aralarından neyin geçtiğini kontrol eder.',
          fact: 'Epitel bariyerleri organ sınırları için gereklidir.' },
        { key: 'nucleus', name: 'Çekirdek', subtitle: 'Talimat deposu', color: '#7a4aa2', count: 1, r: 0.5,
          attrs: [['Konum', 'Bazalden merkeze'], ['Şekil', 'Oval'], ['Işık mikroskobunda görünür', 'Evet']],
          note: 'Epitel çekirdeği genetik bilgiyi depolar ve doku şekline bağlı olarak konumunu değiştirir.',
          fact: 'Çekirdek şekli, patologların doku örneklerini okumasına yardımcı olur.' },
        { key: 'mito', name: 'Mitokondri', subtitle: 'Enerji santrali', color: '#cf6f42', count: 4, r: 0.12,
          attrs: [['Konum', 'Bazal ve apikal bölgeler'], ['Görev', 'ATP üretimi'], ['Önemi', 'Aktif taşıma']],
          note: 'Emilim yapan epitel hücreleri, besinleri ve iyonları gradyana karşı taşımak için bol mitokondri içerir.',
          fact: 'Böbrek tübül epitel hücreleri vücudun en mitokondri-zengin hücreleri arasındadır.' },
        { key: 'golgi', name: 'Golgi Aygıtı', subtitle: 'Salgı paketleyici', color: '#d49057', count: 1, r: 0.3,
          attrs: [['Konum', 'Çekirdek üstü (apikal)'], ['Görev', 'Salgı ve zar proteinleri'], ['Şekil', 'Yassı kese yığını']],
          note: 'Epitel hücrelerinde Golgi, mukus gibi salgıları ve apikal zara gidecek proteinleri paketleyip doğru yüzeye yönlendirir.',
          fact: 'Golgi, polariteyi korumak için proteinleri apikal ve bazolateral zara ayrı ayrı gönderir.' }
      ]
    },
    {
      id: 'bacteria', name: 'Bakteri Hücresi', type: 'Prokaryotik Hücre', accent: '#48a77d', shape: 'bacteria',
      occurrence: 'Toprak, su, bağırsak, deri — bakteriler neredeyse her ortamda yaşayabilir ve bağımsız tek hücreler olarak var olabilir.',
      clinical: 'Hücre duvarı yapısı, mikroskopi ve Gram boyamadan antimikrobiyal mekanizma tartışmalarına klinik olarak anlamlı bir yol sunar.',
      defaultOrganelle: 'wall',
      model: {
        url: 'models/cells/bacteria-wall.glb', textured: false, label: 'Gram (+) Duvar Kesiti',
        shade: { mode: 'height', stops: [[0, '#e8c48a'], [0.36, '#e8c48a'], [0.4, '#4fb58c'], [0.79, '#4fb58c'], [0.83, '#c9824a'], [1, '#c9824a']] },
        credit: 'Model: "Gram Positive Bacterial Cell Wall Model" — NIH 3D (3DPX-010752), Kamu Malı (CC0). Normaller yeniden hesaplandı ve renklendirildi.',
        pins: {
          wall: [0.828, 0.454, 1.211, 0, 0, 1],
          membrane: [-0.165, -1.173, 1.187, 0, 0, 1],
          teichoic: [0.364, 1.359, -0.121, 0.553, 0.067, 0.831],
          protein: [2.473, -0.902, 0.365, 0.946, 0.015, 0.323]
        }
      },
      organelles: [
        { key: 'wall', name: 'Hücre Duvarı (Peptidoglikan)', subtitle: 'Koruyucu kabuk', color: '#4fb58c', count: 1, r: 1.0,
          attrs: [['Malzeme', 'Peptidoglikan'], ['Kalınlık (Gram +)', '20–80 nm'], ['Konum', 'Zarın dışında']],
          note: 'Bakteri hücre duvarı, hücrelerin iç basınca direnmesine yardımcı olur ve birçok türe karakteristik şeklini verir. Gram pozitiflerde kalın peptidoglikan tabakası mor boyayı tutar.',
          fact: 'Penisilin, peptidoglikan çapraz bağlarını kuran enzimi engelleyerek etki eder.' },
        { key: 'membrane', name: 'Plazma Zarı', subtitle: 'Seçici bariyer', color: '#e8c48a', realOnly: true,
          attrs: [['Yapı', 'Fosfolipit çift katman'], ['Konum', 'Duvarın altında'], ['Görev', 'Madde alışverişi']],
          note: 'Fosfolipitlerin su seven başları dışa, su sevmeyen kuyrukları içe bakar; bu çift katman hangi maddelerin hücreye girip çıkacağını seçer.',
          fact: 'Bakterilerde mitokondri yoktur; ATP üreten solunum enzimleri doğrudan bu zarda bulunur.' },
        { key: 'teichoic', name: 'Teikoik Asitler', subtitle: 'Duvar zincirleri', color: '#c9824a', realOnly: true,
          attrs: [['Bulunduğu yer', 'Gram pozitif duvar'], ['Yapı', 'Uzun polimer zincirler'], ['Görev', 'Sağlamlık, tutunma']],
          note: 'Teikoik ve lipoteikoik asitler peptidoglikan tabakasından dışarı uzanır; duvara negatif yük kazandırır ve konak hücreye tutunmada rol oynar.',
          fact: 'Gram negatif bakterilerde teikoik asit bulunmaz — iki grubu ayıran özelliklerden biri.' },
        { key: 'protein', name: 'Zar Proteinleri', subtitle: 'Taşıyıcı kanallar', color: '#7fb2d8', realOnly: true,
          attrs: [['Konum', 'Zarı boydan boya'], ['Görev', 'Taşıma ve algılama'], ['Tür', 'İntegral protein']],
          note: 'Zarı boydan boya geçen proteinler besinleri içeri alır, atıkları dışarı pompalar ve çevredeki kimyasal sinyalleri algılar.',
          fact: 'Bazı antibiyotikler tam da zarın bütünlüğünü veya bu taşıyıcıları hedef alır.' },
        { key: 'nucleoid', name: 'Nükleoid', subtitle: 'Çıplak genom', color: '#7a43ad', count: 1, r: 0.4,
          attrs: [['Boyut', '~1 µm bölge'], ['Zar', 'Yok'], ['Işık mikroskobunda görünür', 'Hayır, sadece EM']],
          note: 'Ökaryotik hücrelerin aksine bakterilerde çekirdek zarfı yoktur; halka şeklindeki DNA nükleoid adı verilen bir sitoplazma bölgesinde serbestçe bulunur.',
          fact: 'E. coli DNA\'sı açılsa hücrenin ~1000 katı uzunluğa ulaşır.' },
        { key: 'flagellum', name: 'Kamçı (Flagellum)', subtitle: 'Yüzme kuyruğu', color: '#c9824a', count: 1, r: 0.04,
          attrs: [['Görev', 'Hareket'], ['Şekil', 'Sarmal filament'], ['Motor', 'Proton gradyanı']],
          note: 'Bazı bakteriler sıvı ortamlarda hareket etmek için kamçılarını minik pervaneler gibi döndürür.',
          fact: 'Bakteri kamçı motoru dakikada 100.000 devire ulaşabilir.' }
      ]
    },
    {
      id: 'muscle', name: 'Kas Hücresi', type: 'Kas Lifi', accent: '#bd514d', shape: 'muscle',
      occurrence: 'İskelet kasları — kısalarak kuvvet üreten tekrarlayan kasılma birimleri (sarkomerler) içerir.',
      clinical: 'Kas lifi mimarisi, mikroskobik yapıyı kasılma, yorgunluk, rehabilitasyon ve nöromüsküler hastalık öğretimiyle ilişkilendirir.',
      defaultOrganelle: 'myofibril',
      organelles: [
        { key: 'myofibril', name: 'Miyofibril', subtitle: 'Kasılan iplik', color: '#bd3d51', count: 1, r: 0.07,
          attrs: [['Çap', '~1 µm'], ['Düzen', 'A ve I bantları (çizgili)'], ['Birim', 'Sarkomer (~2,5 µm)']],
          note: 'Her kas lifi, tüm uzunluğu boyunca sıkıca paketlenmiş yüzlerce-binlerce miyofibril içerir. Koyu (A) ve açık (I) bantlar aktin-miyozin dizilişinden doğar.',
          fact: 'Tek bir kas lifi 30 cm uzunluğa ulaşabilir.' },
        { key: 'sarcolemma', name: 'Sarkolemma', subtitle: 'Uyarılabilir zar', color: '#d7b284', count: 1, r: 0.05,
          attrs: [['Konum', 'Dış yüzey'], ['Görev', 'Sinyal yayılımı'], ['Uzantı', 'T tübülleri']],
          note: 'Sarkolemma, kas lifi boyunca kasılmayı tetikleyen elektriksel sinyalleri iletir.',
          fact: 'Membran sinyalleri T tübülleri aracılığıyla liflerin derinliklerine ulaşır.' },
        { key: 'nucleus', name: 'Çekirdekler', subtitle: 'Çok çekirdekli lif', color: '#7a4aa2', count: 6, r: 0.1,
          attrs: [['Sayı', 'Yüzlerce'], ['Konum', 'Sarkolemma altında, çevrede'], ['Köken', 'Hücre kaynaşması']],
          note: 'İskelet kası lifi, gelişim sırasında birçok miyoblastın kaynaşmasıyla oluşur; bu yüzden zarın hemen altında dizili çok sayıda çekirdek taşır.',
          fact: 'Kalp kası hücreleri ise genellikle tek ya da iki çekirdeklidir.' },
        { key: 'mito', name: 'Mitokondriler', subtitle: 'Dayanıklılık kaynağı', color: '#cf7042', count: 10, r: 0.1,
          attrs: [['Görev', 'Enerji kaynağı'], ['Konum', 'Miyofibriller arasında'], ['Yoğunluk', 'Aktiviteye bağlı']],
          note: 'Kas hücrelerinin çok sayıda mitokondriye ihtiyacı vardır çünkü kasılma büyük miktarda ATP tüketir.',
          fact: 'Dayanıklılık antrenmanı mitokondri yoğunluğunu artırabilir.' }
      ]
    }
  ];

  window.CellData = { CELLS };
})();
