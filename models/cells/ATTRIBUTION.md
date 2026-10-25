# Hücre modelleri — kaynak ve lisans

Modül 2'deki gerçekçi 3B hücre modelleri aşağıdaki kaynaklardan alınmış, web için
sadeleştirilmiş (gltf-transform: geometri sadeleştirme, KHR_mesh_quantization,
2048 px JPEG doku) ve gerektiğinde yüzey normalleri yeniden hesaplanmıştır.

| Dosya | Kaynak | Lisans |
| --- | --- | --- |
| `plant-cell.glb` | [cclank/cell-architecture-studio](https://github.com/cclank/cell-architecture-studio) — `public/models/plant-cell-first001.glb` (depo sahibinin Tripo ile ürettiği model) | Depo lisansı: MIT |
| `white-blood-cell.glb` | [cclank/cell-architecture-studio](https://github.com/cclank/cell-architecture-studio) — `public/models/white-blood-cell-user.glb` (depo sahibinin Tripo ile ürettiği model) | Depo lisansı: MIT |
| `epithelial-cell.glb` | [huangserva/3DCellForge](https://github.com/huangserva/3DCellForge) — `public/generated-models/tripo-epithelial-cell-test.glb` (Tripo ile üretilmiş) | Depo lisansı: MIT |
| `neuron.glb` | "Neuron" — destacados tv, [NIH 3D 3DPX-015796](https://3d.nih.gov/entries/3DPX-015796/2) | **CC BY-NC-SA 4.0** — ticari olmayan kullanım; bu değiştirilmiş sürüm de aynı lisansla paylaşılır |
| `bacteria-wall.glb` | "Gram Positive Bacterial Cell Wall Model" — [NIH 3D 3DPX-010752](https://3d.nih.gov/entries/3DPX-010752/2) | Kamu malı (CC0 1.0) |

Notlar:
- MIT lisanslı depolardaki Tripo modellerinin ilk kaynağı depo sahipleridir; bu proje onları depo lisansı kapsamında yeniden dağıtır.
- `neuron.glb` ticari olmayan (NC) lisanslıdır. Proje ileride ticari kullanılacaksa bu model kaldırılmalı veya değiştirilmelidir; uygulama o durumda nöron için kendi şematik modeline döner.
- Hayvan hücresi ve kas hücresi için açık lisanslı uygun bir model bulunamadığından bu ikisi yalnızca affeBio'nun kendi şematik (yordamsal) modelleriyle gösterilir.
