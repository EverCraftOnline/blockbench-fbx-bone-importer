import * as THREE from 'https://threejs.org/build/three.module.js';
import { FBXLoader } from './FBXLoader.js';

const fbx_bone_importer = {
    id: 'fbx_bone_importer',
    name: 'FBX Bone Importer',
    icon: 'icon', // Replace 'icon' with an icon file or a Material Icons name
    author: 'h1ddentree productions',
    description: 'Import bone hierarchy from FBX files',
    version: '1.0.0',
    min_version: '3.0.0',
    variant: 'both',
    onload() {
        this.registerPlugin();
    },
    onunload() {
        // Clean up when the plugin is unloaded (if necessary)
    },
    registerPlugin() {
        const importAction = new Action('import_fbx_bone_hierarchy', {
            name: 'Import Bone Hierarchy from FBX',
            description: 'Import bone hierarchy from an FBX file',
            icon: 'icon', // Replace 'icon' with an icon file or a Material Icons name
            click: () => {
                this.importFbx();
            },
        });

        importAction.addMenuNode(MenuBar.plugins);
    },
    importFbx() {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.fbx';
    
        fileInput.onchange = (event) => {
            // Load FBX file
            const file = event.target.files[0];
            const reader = new FileReader();
    
            reader.onload = () => {
                const loader = new FBXLoader();
                loader.load(reader.result, (object) => {
                    // Process the bone hierarchy
                    const skeleton = object.children.find(child => child instanceof THREE.Skeleton);
                    if (skeleton) {
                        this.processBones(skeleton.bones);
                    } else {
                        Blockbench.showMessageBox({
                            title: 'Error',
                            message: 'No bone hierarchy found in the selected FBX file.',
                            icon: 'error'
                        });
                    }
                });
            };
    
            reader.readAsArrayBuffer(file);
        };
    
        fileInput.click();
    },
    processBones(bones) {
        // Traverse the bone hierarchy and create Blockbench bones
        bones.forEach(bone => {
            this.createBlockbenchBone(bone);
        });
    },    
    createBlockbenchBone(bone) {
        // Create a Blockbench bone from a Three.js bone
        const bbBone = new Group({
            name: bone.name,
            from: bone.position.toArray(),
            rotation: bone.rotation.toArray().map(THREE.MathUtils.radToDeg),
            scale: bone.scale.toArray()
        });

        bbBone.addTo(Group.selected);

        // Process and add children
        bone.children.forEach(child => {
            if (child instanceof THREE.Bone) {
                const bbChild = this.createBlockbenchBone(child);
                bbChild.addTo(bbBone);
            }
        });

        return bbBone;
    }
};

Blockbench.addPlugin(fbx_bone_importer);