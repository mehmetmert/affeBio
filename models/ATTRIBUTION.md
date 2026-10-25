# Anatomi verisi atıf metni (CC BY 4.0)

Modül 1 (3B İnsan Anatomisi), **BodyParts3D 4.0** veri setini kullanır.

- **Kaynak:** BodyParts3D, © The Database Center for Life Science, Japonya.
- **Lisans:** CC Attribution 4.0 International — https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- **Veri seti indirme sayfası:** https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- **Yayın:** Mitsuhashi N. et al. (2009), *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research. https://doi.org/10.1093/nar/gkn613
- İçerik: 2.234 ayrı mesh, 3.432 adlandırılmış FMA (Foundational Model of Anatomy) kavramı; yetişkin erkek referans anatomisi (MRI ve anatomik atlas verilerinden üretilmiştir).

## Bu projedeki adaptasyonlar

- İkili (binary) mesh paketleme formatı (`atlas.json` manifest + `body-N.bin.gz` parçalar) ve yükleme/gzip-çözme yaklaşımı, MIT lisanslı açık kaynak **slorksmo/Human-Atlas** projesinin (`atlas.taim.best`) yayımladığı veri paketinden yeniden kullanılmıştır — bu paketleme kodu MIT lisanslıdır, ancak içindeki anatomik veri BodyParts3D'den gelir ve CC BY 4.0 koşullarına tabidir.
- Sistem renkleri ve ~130 yapı açıklaması da aynı projenin açık kaynaklı `app/anatomy.ts` dosyasından (İngilizce metin, olduğu gibi) alınmış, sistem adları ve arayüz Türkçeye çevrilmiştir.
- Yalnızca erkek referans gövdesi (BodyParts3D 4.0) bu projeye dahil edilmiştir; kaynak projedeki kadın referans gövdesi (Human Reference Atlas v1.10) henüz entegre edilmemiştir.

Bu atıf metni, uygulama içinde Modül 1'in sağ panelinde ("Kaynak & Lisans") kalıcı olarak gösterilir.
