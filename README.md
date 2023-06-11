# BAW Fish YOLOv5

Repository for utility helper, training and setup of YOLOv5.

## Utility Demo Homepage

<https://hannesoberreiter.github.io/baw-fish-cell-yolo>

## Setup environment

```bash
# Create environment inside project folder
python3 -m venv env
# Activate environment
source env/bin/activate
# Clone Yolo
git clone https://github.com/ultralytics/yolov5
# Install packages into environment
pip install -r yolov5/requirements.txt
# Unzip dataset
unzip content/dataset.zip
```

## LabelImg

<https://github.com/heartexlabs/labelImg>

## Changing source images

If you change the source images please create a new `content/dataset.zip` file, as the dataset folder is not version controlled.

```bash
cd content
zip -r dataset.zip dataset
```

## Important files

Inside [content](content) folder you can find the `fish.yaml` to define folder paths to the dataset and classes. The `current.pt` file are the currently used weights of the best training run. The archive `dataset.zip` contains the training and validation dataset.

The **notebook** [index.ipynb](index.ipynb) contains all information to run training and testing.

## Fish Blood Cells Example Prediction Result

![example inference result](/example_result.jpg)

## License

[GNU Affero General Public License v3.0](LICENSE.md)
