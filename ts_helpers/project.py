from os import path
import os

def find_project_file(file_path):
    a, b = path.split(file_path)
    while b != "":
        files = os.listdir(a)
        if ".sublimets" in files:
            print("FOUND project file", path.join(a, ".sublimets"), "for ts file ", file_path)
            return path.join(a, ".sublimets")
        a, b = path.split(a)

    return file_path
