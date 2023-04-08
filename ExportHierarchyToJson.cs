using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

public class ExportHierarchyToJson : MonoBehaviour
{
    [MenuItem("Tools/Export Hierarchy to JSON")]
    static void ExportSelectedHierarchyToJson()
    {
        GameObject selectedObject = Selection.activeGameObject;

        if (selectedObject != null)
        {
            string jsonString = CreateJsonFromHierarchy(selectedObject.transform);
            string savePath = EditorUtility.SaveFilePanel("Save hierarchy JSON", "", "hierarchy.json", "json");
            if (!string.IsNullOrEmpty(savePath))
            {
                File.WriteAllText(savePath, jsonString);
            }
        }
        else
        {
            Debug.LogWarning("No GameObject selected. Please select the root of the hierarchy you want to export.");
        }
    }

    static string CreateJsonFromHierarchy(Transform rootTransform)
    {
        BoneNode rootBoneNode = CreateBoneNode(rootTransform);
        return JsonUtility.ToJson(rootBoneNode, true);
    }

    static BoneNode CreateBoneNode(Transform transform)
    {
        BoneNode boneNode = new BoneNode
        {
            name = transform.name,
            position = transform.localPosition,
            rotation = transform.localRotation.eulerAngles,
            scale = transform.localScale
        };

        foreach (Transform child in transform)
        {
            boneNode.children.Add(CreateBoneNode(child));
        }

        return boneNode;
    }
}

[System.Serializable]
public class BoneNode
{
    public string name;
    public Vector3 position;
    public Vector3 rotation;
    public Vector3 scale;
    public List<BoneNode> children = new List<BoneNode>();
}
