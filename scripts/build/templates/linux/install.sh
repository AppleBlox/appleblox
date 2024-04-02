#!/bin/sh

echo "Installing {APP_NAME} in '{APP_PATH}'..."
mkdir {APP_PATH}
cp ./{APP_BUNDLE}.tgz {APP_PATH}
cd {APP_PATH}
tar -xvzf {APP_BUNDLE}.tgz
rm {APP_BUNDLE}.tgz
chmod +x neu_main
mv app.desktop {APP_BUNDLE}.desktop

read -p "Delete Installer files? (y/n): " answer
if [[ $answer == "y" ]]; then
    echo "Deleting ..."
    cd ..
    rm -rf {APP_NAME}
fi

gtk-launch {APP_PATH}/{APP_BUNDLE}.desktop
echo "DONE"