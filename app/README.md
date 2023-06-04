# BAW Yolo

Frontend application which loads the Yolo model for inference.

## Convert YoloV5 to tfjs

To be able to use our trained model in the frontend, we need to convert it to tfjs format. This can be done by running the following command in the root directory of the project:

```bash
python yolov5/export.py --weights content/current.pt  --include tfjs
cp -r content/current_web_model app/public/models/cell-counter
```
