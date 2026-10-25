/* ============================================================================
   affeBio (affeLab: Biology) — Referans Veri Katmanı
   İçerik: Anatomi Sistemleri & Organlar · Hücre Organelleri (Hayvan/Bitki)
           · 64 Kodonluk Standart Genetik Kod Tablosu · scienceWiki İçeriği
   ============================================================================ */
(function () {
  'use strict';

  /* ==========================================================================
     1. MODÜL 1: İNSAN ANATOMİSİ — SİSTEMLER VE ORGANLAR
     ========================================================================== */
  const SYSTEMS = [
    { key: 'skeletal', name: 'İskelet Sistemi', color: '#e2e8f0', defaultOpacity: 0.9 },
    { key: 'muscular', name: 'Kas Sistemi', color: '#ff3366', defaultOpacity: 0.55 },
    { key: 'circulatory', name: 'Dolaşım Sistemi', color: '#ef4444', defaultOpacity: 0.65 },
    { key: 'nervous', name: 'Sinir Sistemi', color: '#f59e0b', defaultOpacity: 0.6 },
    { key: 'organs', name: 'İç Organlar', color: '#00e8a8', defaultOpacity: 0.85 }
  ];

  // mod1-anatomy.js'teki BODY eklem tablosuyla aynı ölçek (ayak tabanı y=0, baş y≈6.05).
  const ORGANS = [
    { id: 'brain', name: 'Beyin', system: 'nervous', pos: [0, 6.05, 0.08], color: '#f59e0b',
      fn: 'Merkezi sinir sisteminin komuta merkezi; bilinç, hareket planlama, duyu entegrasyonu ve homeostazdan sorumludur.' },
    { id: 'heart', name: 'Kalp', system: 'circulatory', pos: [-0.14, 4.6, 0.32], color: '#ef4444',
      fn: 'Dakikada ortalama 70 kez kasılarak kanı tüm vücuda pompalayan içi boş kas organı; sistemik ve pulmoner dolaşımı sürdürür.' },
    { id: 'lungs', name: 'Akciğerler', system: 'organs', pos: [-0.42, 4.65, 0.22], color: '#60a5fa',
      fn: 'Alveollerde O₂ ile CO₂ gaz değişimini sağlayan sünger yapılı solunum organları.' },
    { id: 'liver', name: 'Karaciğer', system: 'organs', pos: [0.32, 3.95, 0.3], color: '#b45309',
      fn: 'Metabolizmanın merkezi: detoksifikasyon, safra üretimi, glikojen depolama ve plazma proteini sentezi yapar.' },
    { id: 'stomach', name: 'Mide', system: 'organs', pos: [-0.22, 3.85, 0.3], color: '#f97316',
      fn: 'HCl ve pepsin salgılayarak proteinlerin sindirimine başlayan kaslı torba organ.' },
    { id: 'kidneys', name: 'Böbrekler', system: 'organs', pos: [0.3, 3.55, -0.2], color: '#a855f7',
      fn: 'Kanı süzerek metabolik atıkları, fazla suyu ve tuzu idrar halinde uzaklaştıran, kan basıncını düzenleyen çift organ.' },
    { id: 'spine', name: 'Omurga', system: 'skeletal', pos: [0, 4.3, -0.04], color: '#e2e8f0',
      fn: '33 omurdan oluşan eksen iskelet; gövdeyi taşır, omuriliği korur ve esnek hareket sağlar.' },
    { id: 'femur', name: 'Femur (Uyluk Kemiği)', system: 'skeletal', pos: [0.28, 2.55, 0.03], color: '#e2e8f0',
      fn: 'İnsan vücudundaki en uzun ve en güçlü kemik; kalça ile dizi birbirine bağlar.' },
    { id: 'biceps', name: 'Biceps Brachii', system: 'muscular', pos: [0.88, 4.8, 0.05], color: '#ff3366',
      fn: 'Dirseği büken ve ön kolu supine eden iki başlı kol kası.' },
    { id: 'spinalcord', name: 'Omurilik', system: 'nervous', pos: [0, 5.1, -0.02], color: '#f59e0b',
      fn: 'Beyinden gelen motor komutları kaslara, duyu bilgisini beyne taşıyan ve basit refleksleri yöneten sinir demeti.' }
  ];

  /* Modül 2 hücre verisi js/cell-data.js dosyasına taşındı (window.CellData). */


  /* ==========================================================================
     3. MODÜL 3: STANDART GENETİK KOD TABLOSU (64 KODON)
     ========================================================================== */
  const AA_INFO = {
    Phe: { c: '#fbbf24', full: 'Fenilalanin' }, Leu: { c: '#fbbf24', full: 'Lösin' },
    Ile: { c: '#fbbf24', full: 'İzolösin' }, Met: { c: '#fbbf24', full: 'Metiyonin (Start)' },
    Val: { c: '#fbbf24', full: 'Valin' }, Ser: { c: '#34d399', full: 'Serin' },
    Pro: { c: '#fbbf24', full: 'Prolin' }, Thr: { c: '#34d399', full: 'Treonin' },
    Ala: { c: '#fbbf24', full: 'Alanin' }, Tyr: { c: '#34d399', full: 'Tirozin' },
    His: { c: '#60a5fa', full: 'Histidin' }, Gln: { c: '#34d399', full: 'Glutamin' },
    Asn: { c: '#34d399', full: 'Asparagin' }, Lys: { c: '#60a5fa', full: 'Lizin' },
    Asp: { c: '#ef4444', full: 'Aspartik Asit' }, Glu: { c: '#ef4444', full: 'Glutamik Asit' },
    Cys: { c: '#34d399', full: 'Sistein' }, Trp: { c: '#fbbf24', full: 'Triptofan' },
    Arg: { c: '#60a5fa', full: 'Arjinin' }, Gly: { c: '#fbbf24', full: 'Glisin' },
    STOP: { c: '#64748b', full: 'Dur Kodonu' }
  };

  // mRNA kodonları -> amino asit (3 harfli kod). Standart genetik kod.
  const CODON_TABLE = {
    UUU: 'Phe', UUC: 'Phe', UUA: 'Leu', UUG: 'Leu',
    CUU: 'Leu', CUC: 'Leu', CUA: 'Leu', CUG: 'Leu',
    AUU: 'Ile', AUC: 'Ile', AUA: 'Ile', AUG: 'Met',
    GUU: 'Val', GUC: 'Val', GUA: 'Val', GUG: 'Val',
    UCU: 'Ser', UCC: 'Ser', UCA: 'Ser', UCG: 'Ser',
    CCU: 'Pro', CCC: 'Pro', CCA: 'Pro', CCG: 'Pro',
    ACU: 'Thr', ACC: 'Thr', ACA: 'Thr', ACG: 'Thr',
    GCU: 'Ala', GCC: 'Ala', GCA: 'Ala', GCG: 'Ala',
    UAU: 'Tyr', UAC: 'Tyr', UAA: 'STOP', UAG: 'STOP',
    CAU: 'His', CAC: 'His', CAA: 'Gln', CAG: 'Gln',
    AAU: 'Asn', AAC: 'Asn', AAA: 'Lys', AAG: 'Lys',
    GAU: 'Asp', GAC: 'Asp', GAA: 'Glu', GAG: 'Glu',
    UGU: 'Cys', UGC: 'Cys', UGA: 'STOP', UGG: 'Trp',
    CGU: 'Arg', CGC: 'Arg', CGA: 'Arg', CGG: 'Arg',
    AGU: 'Ser', AGC: 'Ser', AGA: 'Arg', AGG: 'Arg',
    GGU: 'Gly', GGC: 'Gly', GGA: 'Gly', GGG: 'Gly'
  };

  const MUTATIONS = [
    { key: 'sickle', name: 'Orak Hücreli Anemi', gene: 'HBB (β-globin)', seq: 'GTGCACCTGACTCCTGAGGAG', mutIndex: 6, from: 'A', to: 'T',
      desc: '11. kromozomdaki β-globin geninde tek bir nükleotid değişimi (GAG→GTG), 6. kodonda Glutamik Asit yerine Valin kodlanmasına yol açar; bu da hemoglobinin polimerleşip alyuvarları orak şekline sokmasına neden olur.' }
  ];

  /* ==========================================================================
     4. SCIENCEWIKI "AKADEMİK BİLGİ & TEORİ" İÇERİĞİ
     ========================================================================== */
  const SCIENCE_WIKI = {
    bio1_1: {
      title: '3B İnsan Anatomisi Laboratuvarı',
      intuitive: 'Vücudunuzu tek bir "şey" gibi değil, birbirinin içine geçmiş katmanlar olarak düşünün: en dışta kaslar, onların altında iskelet, her ikisinin arasında dolaşan kan damarları ve her yeri saran bir sinir ağı. Katmanların opaklığını ayrı ayrı değiştirerek, deriyi soymadan vücudun "içine" bakabilirsiniz — tıpkı bir MR cihazının yaptığı gibi.',
      history: 'Modern anatominin temeli, 1543\'te Andreas Vesalius\'un <i>De Humani Corporis Fabrica</i> adlı eseriyle atıldı; Vesalius, otopsilere dayanarak insan vücudunu ilk kez bu kadar doğru çizdi. 20. yüzyılın sonunda başlayan Visible Human Project, gerçek bir insan bedenini milimetrik dilimler halinde tarayıp dijitalleştirerek bugünün 3B anatomi atlaslarının (BioDigital, Zygote Body) temelini oluşturdu.',
      formulas: [
        { tex: '\\text{Kalp Debisi } (Q) = \\text{Atım Hacmi} \\times \\text{Kalp Hızı}', desc: 'Kalbin dakikada pompaladığı kan hacmi; ortalama bir yetişkinde ~70 mL × 70 atım/dk ≈ 4.9 L/dk.' }
      ],
      tasks: [
        { step: 'Sol panelden sadece "İskelet Sistemi" katmanını %100 opaklıkta bırakıp diğerlerini kapatın; omurganın gövdeyi nasıl taşıdığını inceleyin.', preset: { sub: '1_1', layers: { skeletal: 1, muscular: 0, circulatory: 0, nervous: 0, organs: 0 } } },
        { step: 'Kalbe tıklayıp kamera yakınlaşmasını izleyin, ardından bilgi kartındaki kalp debisi formülünü yukarıdaki ile karşılaştırın.', preset: { sub: '1_1', focusOrgan: 'heart' } }
      ]
    },
    bio2_1: {
      title: 'Hücre İçi Ziyaret & Makromoleküler Simülatör',
      intuitive: 'Lise kitaplarındaki hücre resimleri, içi boş bir oda gibi görünür — oysa gerçek sitoplazma, trilyonlarca proteinin saniyede milyarlarca kez çarpıştığı kalabalık bir şehir merkezi gibidir (Brownian hareketi). "Makromoleküler Kalabalık" modunu açtığınızda, ders kitabı sadeliğinden bu gerçekçi kaosa geçiş yaparsınız.',
      history: 'Robert Hooke 1665\'te mantar dokusunu incelerken gördüğü küçük odacıklara Latince "hücre" anlamına gelen <i>cellula</i> adını verdi. Ancak hücrenin canlılığın temel birimi olduğu fikri (Hücre Teorisi), ancak 1830\'larda Matthias Schleiden ve Theodor Schwann\'ın çalışmalarıyla kesinleşti. Kloroplastların ve mitokondrinin kendi DNA\'larına sahip olması, Lynn Margulis\'in 1967 Endosimbiyoz Teorisi\'nin kanıtıdır: bu organeller bir zamanlar bağımsız bakterilerdi.',
      formulas: [
        { tex: '6CO_2 + 6H_2O \\xrightarrow{\\text{ışık}} C_6H_{12}O_6 + 6O_2', desc: 'Kloroplastlarda gerçekleşen fotosentez: ışık enerjisi kullanılarak glikoz ve oksijen üretilir.' },
        { tex: 'C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + \\sim 36\\ ATP', desc: 'Mitokondride gerçekleşen oksijenli solunum: glikozun kimyasal enerjisi ATP\'ye aktarılır.' }
      ],
      tasks: [
        { step: 'Hayvan ve Bitki hücresi arasında geçiş yaparak hangi organellerin sadece bitkide bulunduğunu listeleyin.', preset: { sub: '2_1', cellType: 'plant' } },
        { step: '"Makromoleküler Kalabalık" modunu açıp kapatarak sitoplazmanın gerçekçi yoğunluğunu klasik ders kitabı görünümüyle karşılaştırın.', preset: { sub: '2_1', crowding: true } }
      ]
    },
    bio3_1: {
      title: 'Santral Dogma: Gen\'den Proteine',
      intuitive: 'DNA, kütüphanedeki asla dışarı çıkarılmayan bir ana kitaptır. Hücre bu kitabı okumak istediğinde, ilgili sayfanın fotokopisini (mRNA) çeker — buna <b>transkripsiyon</b> denir. Fotokopi ribozoma götürülür ve her 3 harflik "kelime" (kodon) bir amino asite çevrilerek protein zinciri örülür — buna <b>translasyon</b> denir.',
      history: 'Francis Crick 1958\'de genetik bilginin akış yönünü "DNA → RNA → Protein" olarak formüle edip buna "Santral Dogma" adını verdi. 1961-1966 arasında Marshall Nirenberg ve Har Gobind Khorana\'nın öncülük ettiği deneyler, 64 kodonun tamamının hangi amino aside karşılık geldiğini çözerek genetik kodu deşifre etti.',
      formulas: [
        { tex: '\\text{DNA (şablon)} \\xrightarrow{\\text{RNA Polimeraz}} \\text{mRNA} \\xrightarrow{\\text{Ribozom}} \\text{Polipeptid}', desc: 'Transkripsiyon (çekirdekte) ve translasyonun (ribozomda) genel akışı.' },
        { tex: 'A \\leftrightarrow U,\\quad T \\leftrightarrow A,\\quad G \\leftrightarrow C,\\quad C \\leftrightarrow G', desc: 'Transkripsiyonda baz eşleşme kuralı: DNA\'daki Timin yerine mRNA\'da Urasil kullanılır.' }
      ],
      tasks: [
        { step: '"ATGGCCTTTAAATAG" DNA dizisini girin; mRNA\'ya ve ardından amino asit zincirine dönüşümünü adım adım izleyin.', preset: { sub: '3_1', dna: 'ATGGCCTTTAAATAG' } },
        { step: 'Dur kodonunun (STOP) ribozomu nasıl durdurduğunu gözlemleyin — zincirin neden orada bittiğini açıklayın.', preset: { sub: '3_1' } }
      ]
    },
    bio3_2: {
      title: 'CRISPR-Cas9 Gen Düzenleme Laboratuvarı',
      intuitive: 'CRISPR-Cas9, bir "ara-bul-değiştir" aracı gibi çalışır: rehber RNA (gRNA) DNA üzerinde hedef diziyi bulur, Cas9 enzimi bir makas gibi orayı keser, hücre kendi onarım mekanizmasıyla kesiği kapatırken siz sağlıklı bir şablon sunarsanız hatalı gen "düzeltilmiş" olur.',
      history: 'CRISPR dizileri ilk kez 1987\'de bakterilerde fark edildi, ancak bunların bir bağışıklık sistemi olduğu 2007\'de anlaşıldı. 2012\'de Jennifer Doudna ve Emmanuelle Charpentier, Cas9 enzimini programlanabilir bir gen düzenleme aracına dönüştürdü ve bu çalışmayla 2020 Nobel Kimya Ödülü\'nü kazandılar.',
      formulas: [
        { tex: '\\text{gRNA (20 nt)} + \\text{Cas9} \\rightarrow \\text{Hedef DNA\'da Çift Zincir Kırığı}', desc: 'CRISPR-Cas9 kompleksinin temel mekanizması: rehber RNA hedefi tanır, Cas9 keser.' },
        { tex: '5\'\\text{-}[\\,N_{20}\\,]\\text{-}NGG\\text{-}3\'\\quad \\Rightarrow\\quad \\text{kesim: PAM\'in 3 bç yukarısı}', desc: 'SpCas9 yalnızca hedefin hemen 3′ ucunda NGG (PAM) varsa bağlanır ve iki zinciri PAM\'in 3 baz yukarısından küt uçlu keser.' },
        { tex: '\\Delta \\bmod 3 \\neq 0 \\;\\Rightarrow\\; \\text{çerçeve kayması}', desc: 'NHEJ\'in bıraktığı ekleme/silme (Δ) 3\'ün katı değilse okuma çerçevesi kayar; kesimden sonraki kodonlar değişir ve sıklıkla erken STOP oluşur.' }
      ],
      tasks: [
        { step: 'Aday rehberlerden PAM\'i olmayanları seçip neden reddedildiklerini okuyun; ardından geçerli A rehberiyle otomatik oynatıp HDR ile düzeltmeyi izleyin.', preset: { sub: '3_2', guide: 'A', autoplay: true, repair: 'hdr' } },
        { step: 'Aynı kesimi NHEJ ile onarın ve "Tekrar Dene" ile birkaç farklı ekleme/silme deneyin: hangileri çerçeveyi koruyor, hangileri erken STOP oluşturuyor?', preset: { sub: '3_2', guide: 'A', repair: 'nhej' } },
        { step: 'B rehberini seçin: kesim mutasyona uzak düştüğünde HDR veriminin neden düştüğünü sonuç kartından inceleyin.', preset: { sub: '3_2', guide: 'B', repair: 'hdr' } }
      ]
    },
    bio3_3: {
      title: 'Sanal Biyoteknoloji Laboratuvarı',
      intuitive: 'Gerçek bir moleküler biyoloji laboratuvarında DNA\'yı gözle göremezsiniz; onun yerine pipet, PCR cihazı ve jel elektroforez gibi araçlarla "dolaylı" olarak çalışırsınız. Bu sanal tezgah, bu adımları güvenle ve sınırsızca tekrar deneyebileceğiniz bir alan sunar.',
      history: 'Kary Mullis 1983\'te PCR (Polimeraz Zincir Reaksiyonu) yöntemini geliştirerek az miktardaki DNA\'yı milyonlarca kopyaya çoğaltmayı mümkün kıldı ve 1993 Nobel Kimya Ödülü\'nü kazandı. Jel elektroforez ise 1970\'lerden beri DNA parçalarını boyutlarına göre ayırmanın altın standardı olmuştur.',
      formulas: [
        { tex: 'N = N_0 \\times 2^n', desc: 'PCR\'da n döngü sonunda elde edilen DNA kopya sayısı; her döngüde miktar katlanarak artar.' },
        { tex: 'N_{n+1} = N_n\\left[1 + E\\left(1 - \\frac{N_n}{N_{max}}\\right)\\right]', desc: 'Gerçekçi model: döngü başı verim E < 1 ve primer/nükleotit tükenmesi nedeniyle eğri önce üstel artar, sonra plato yapar (lojistik büyüme).' },
        { tex: 'd \\propto -\\log_{10}(\\text{boyut})', desc: 'Agaroz jelde bir DNA parçasının göç mesafesi, boyutunun logaritmasıyla yaklaşık doğrusal ve ters orantılıdır; bilinmeyen boyut merdivene göre bu ilişkiyle tahmin edilir.' }
      ],
      tasks: [
        { step: '"İdeal" koşullarla PCR\'ı çalıştırın; kopya eğrisinin önce ideal 2ⁿ çizgisini izleyip sonra neden plato yaptığını açıklayın.', preset: { sub: '3_3', mode: 'pcr', pcr: 'ideal', run: true } },
        { step: 'Bağlanma sıcaklığını Tm\'nin çok altına çekin, ürünü jelde koşun ve özgül olmayan bantları ile primer dimerini merdivene göre boyutlandırın.', preset: { sub: '3_3', mode: 'pcr', pcr: 'low', run: true } },
        { step: 'Jeli %2 agarozla koşun ve küçük parçaların daha iyi, büyük parçaların daha kötü ayrıldığını %0.7 ile karşılaştırın.', preset: { sub: '3_3', mode: 'gel', gelPct: 2 } }
      ]
    },
    bio4_1: {
      title: 'Nöron Aksiyon Potansiyeli',
      intuitive: 'Bir nöron, zarının iki tarafında farklı iyon derişimleri tutarak bir "pil" gibi davranır. Yeterince güçlü bir uyarı eşik değeri aşarsa, Na⁺ kanalları aniden açılır ve hücre içi pozitife döner (depolarizasyon); hemen ardından K⁺ kanalları açılarak zar eski haline döner (repolarizasyon) — bu "hep ya da hiç" elektrik darbesine aksiyon potansiyeli denir.',
      history: 'Alan Hodgkin ve Andrew Huxley, 1952\'de dev mürekkep balığı aksonu üzerinde yaptıkları deneylerle aksiyon potansiyelinin iyon kanalı tabanlı matematiksel modelini kurdular ve bu çalışmayla 1963 Nobel Ödülü\'nü aldılar.',
      formulas: [
        { tex: 'V_m(t):\\ -70\\,\\text{mV} \\xrightarrow{\\text{eşik} > -55\\,\\text{mV}} +30\\,\\text{mV} \\rightarrow -80\\,\\text{mV (hiperpolarizasyon)} \\rightarrow -70\\,\\text{mV}', desc: 'Zar potansiyelinin aksiyon potansiyeli sırasında izlediği karakteristik yolculuk.' }
      ],
      tasks: [
        { step: 'Uyarı şiddetini eşik değerin altında tutup hiçbir aksiyon potansiyeli tetiklenmediğini doğrulayın ("hep ya da hiç" kuralı).', preset: { sub: '4_1', stimulus: 4 } },
        { step: 'Uyarıyı eşiğin üzerine çıkarıp osiloskopta tam bir aksiyon potansiyeli eğrisi çizdirin.', preset: { sub: '4_1', stimulus: 18 } }
      ]
    },
    bio4_2: {
      title: 'Av-Avcı Popülasyon Dinamiği (Lotka-Volterra)',
      intuitive: 'Tavşan sayısı arttıkça tilkiler daha çok yiyecek bulur ve çoğalır; tilkiler çoğaldıkça tavşan sayısı düşer; tavşan azalınca tilkiler açlıktan azalır; tavşanlar tekrar toparlanır... Bu döngü sonsuza kadar tekrar eder ve grafikte iki popülasyonun birbirini kovalayan dalgalar halinde salındığını görürsünüz.',
      history: 'Alfred Lotka (1925) ve Vito Volterra (1926), birbirinden bağımsız olarak av-avcı ilişkisini aynı diferansiyel denklem çiftiyle modelledi. Volterra, bu modeli I. Dünya Savaşı sırasında Adriyatik Denizi\'nde balıkçılığın azalmasının neden köpekbalığı oranını artırdığını açıklamak için geliştirmişti.',
      formulas: [
        { tex: '\\frac{dR}{dt} = \\alpha R - \\beta R F', desc: 'Av (tavşan) popülasyonu: doğal üreme hızı (α) eksi avcı tarafından avlanma oranı (β).' },
        { tex: '\\frac{dF}{dt} = \\delta \\beta R F - \\gamma F', desc: 'Avcı (tilki) popülasyonu: avdan kazanılan enerjiyle üreme (δβRF) eksi doğal ölüm oranı (γ).' }
      ],
      tasks: [
        { step: 'Avlanma katsayısını (β) sıfıra yakın bir değere çekin; avcı popülasyonunun neden çökmeye başladığını gözlemleyin.', preset: { sub: '4_2', beta: 0.01 } },
        { step: 'Varsayılan parametrelerle simülasyonu çalıştırıp iki eğrinin faz farkını (tilki eğrisi tavşan eğrisini neden takip eder) inceleyin.', preset: { sub: '4_2' } }
      ]
    }
  };

  window.BioData = {
    SYSTEMS,
    ORGANS,
    CODON_TABLE,
    AA_INFO,
    MUTATIONS,
    SCIENCE_WIKI
  };
})();
