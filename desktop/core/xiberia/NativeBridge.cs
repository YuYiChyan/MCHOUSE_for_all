// SPDX-License-Identifier: MIT
// x86 process boundary for the official XIBERIA .NET 4.8 SDK. No firmware API.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Win32;

internal static class NativeBridge {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength=131072 };
    static readonly string[] Toggles = { "Surround", "BassBoost", "VoiceClarity", "SmartVolume" };
    static object audio, engine;
    static string selectedEndpoint, nativeRoot;
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool SetDllDirectory(string directory);
    static object Call(object target, string name, params object[] args) {
        var method=target.GetType().GetMethod(name, BindingFlags.Public|BindingFlags.Instance);
        if(method==null)throw new InvalidOperationException("官方组件缺少所需接口");
        return method.Invoke(target,args);
    }
    static void Bind(string endpoint) {
        if(String.IsNullOrEmpty(endpoint))throw new InvalidOperationException("请连接耳机后重试");
        if(endpoint==selectedEndpoint && engine!=null)return;
        if(!File.Exists(Path.Combine(nativeRoot,"LHDCX_XIBERIA_DLL.dll"))) {
            nativeRoot=Path.GetDirectoryName(FindOfficialExecutable());
            SetDllDirectory(nativeRoot);
        }
        var assembly=Assembly.LoadFrom(Path.Combine(nativeRoot,"LHDCX_XIBERIA_DLL.dll"));
        audio=assembly.GetType("LHDCX_DLL.LibAudioDeviceManager3",true).GetMethod("GetInstance").Invoke(null,null);
        // Match and select the APO of this exact render endpoint, never a default device.
        object[] countArgs={endpoint,(uint)0,(uint)0};
        Call(audio,"GetDeviceApoCount",countArgs);
        uint count=(uint)countArgs[2];
        if(count==0||count>32)throw new InvalidOperationException("请先打开官方 APP 完成耳机音效初始化");
        bool supportedApo=false;
        for(uint index=0;index<count;index++) {
            object[] info={(uint)0,index,null,null};
            Call(audio,"GetDeviceApoInfo",info);
            // Official metadata names these out strings FriendlyName and CopyrightInfo,
            // not CLSIDs. SetDeviceApoClsid takes the endpoint ID, despite its name.
            string description=(info[2] as string??"")+" "+(info[3] as string??"");
            if(new[]{"xiberia","savitech","lhdc"}.Any(name=>description.IndexOf(name,StringComparison.OrdinalIgnoreCase)>=0))supportedApo=true;
        }
        if(!supportedApo)throw new InvalidOperationException("耳机音效端点需要在官方 APP 中完成初始化");
        Call(audio,"SetDeviceApoClsid",(uint)0,endpoint);
        Call(audio,"SetLhdcDevice",endpoint);
        if(!String.Equals((string)Call(audio,"GetLhdcDevice"),endpoint,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("耳机音效端点选择失败");
        engine=assembly.GetType("LHDCX_DLL.LibSavitech3darManager3",true).GetMethod("GetInstance").Invoke(null,null);
        selectedEndpoint=endpoint;
    }
    static Dictionary<string,object> Snapshot() {
        var result=new Dictionary<string,object>();
        uint count=Convert.ToUInt32(Call(engine,"GetEqualizerBandCount"));
        var gains=(double[])Call(engine,"GetEqualizerBandGains");
        var frequencies=(double[])Call(engine,"GetEqualizerCenterFrequencyEx");
        if(count<1||count>32||gains==null||frequencies==null||gains.Length!=count||frequencies.Length!=count || gains.Any(v=>Double.IsNaN(v)||Double.IsInfinity(v)) || frequencies.Any(v=>Double.IsNaN(v)||Double.IsInfinity(v)||v<=0))throw new InvalidOperationException("耳机音效读取失败，请重新连接");
        result["eq"]=new {enabled=(bool)Call(engine,"GetEqualizerState"),gains=gains,frequencies=frequencies};
        result["preset"]=Call(engine,"GetPreset").ToString();
        foreach(string toggle in Toggles) {
            try { result[Char.ToLowerInvariant(toggle[0])+toggle.Substring(1)]=(bool)Call(engine,"Get"+toggle+"State"); }
            catch { /* Each optional control is exposed only after successful readback. */ }
        }
        result["ready"]=true;
        return result;
    }
    static bool Boolean(object value) { if(!(value is bool))throw new ArgumentException("开关值无效");return (bool)value; }
    static double Number(object value) { if(!(value is int)&&!(value is double)&&!(value is decimal))throw new ArgumentException("数值无效");double v=Convert.ToDouble(value);if(Double.IsNaN(v)||Double.IsInfinity(v))throw new ArgumentException("数值无效");return v; }
    static object Dispatch(Dictionary<string,object> request) {
        string command=request.ContainsKey("command")?request["command"] as string:null;
        if(command=="describe")return new {architecture="x86",framework=".NET Framework 4.8",commands=new[]{"status","setEq","setPreset","setSurround","setBassBoost","setVoiceClarity","setSmartVolume","openOfficialApp"}};
        if(command=="openOfficialApp")return LaunchOfficial();
        if(!new[]{"status","setEq","setPreset","setSurround","setBassBoost","setVoiceClarity","setSmartVolume"}.Contains(command))throw new ArgumentException("未知耳机操作");
        Bind(request["endpoint"] as string);
        object value=request.ContainsKey("value")?request["value"]:null;
        if(command=="setEq") {
            var eq=value as Dictionary<string,object>;if(eq==null)throw new ArgumentException("均衡器参数无效");
            bool enabled=Boolean(eq["enabled"]);
            var raw=eq["gains"] as IList;if(raw==null)throw new ArgumentException("均衡器参数无效");
            double[] gains=raw.Cast<object>().Select(Number).ToArray();uint count=Convert.ToUInt32(Call(engine,"GetEqualizerBandCount"));
            if(gains.Length!=count||gains.Any(v=>v< -12||v>12))throw new ArgumentException("均衡器增益范围为 -12 至 +12 dB");
            var previous=(double[])Call(engine,"GetEqualizerBandGains");bool wasEnabled=(bool)Call(engine,"GetEqualizerState");
            try {
                Call(engine,"SetEqualizerBandGains",(object)gains);Call(engine,"SetEqualizerState",enabled);
                var actual=(double[])Call(engine,"GetEqualizerBandGains");
                if(actual.Length!=gains.Length||actual.Where((v,i)=>Math.Abs(v-gains[i])>0.11).Any()||(bool)Call(engine,"GetEqualizerState")!=enabled)throw new InvalidOperationException("均衡器设置未生效");
            } catch { try{Call(engine,"SetEqualizerBandGains",(object)previous);Call(engine,"SetEqualizerState",wasEnabled);}catch{}throw; }
        } else if(command=="setPreset") {
            var method=engine.GetType().GetMethod("SetPreset");var enumType=method.GetParameters()[0].ParameterType;
            var name=value as string;
            if(name==null||!new[]{"Movie","Gaming","Music","Voice","Balanced","Shooter","Racing","Roleplay","Customize"}.Contains(name))throw new ArgumentException("音效预设无效");
            method.Invoke(engine,new[]{Enum.Parse(enumType,name)});
            if(Call(engine,"GetPreset").ToString()!=name)throw new InvalidOperationException("音效预设设置未生效");
        } else if(command.StartsWith("set",StringComparison.Ordinal)) {
            string toggle=command.Substring(3);if(!Toggles.Contains(toggle))throw new ArgumentException("未知音效");
            bool enabled=Boolean(value);Call(engine,"Set"+toggle+"State",enabled);
            if((bool)Call(engine,"Get"+toggle+"State")!=enabled)throw new InvalidOperationException("音效设置未生效");
        }
        return Snapshot();
    }
    static string FindOfficialExecutable() {
        var candidates=new List<string>();
        foreach(var view in new[]{RegistryView.Registry32,RegistryView.Registry64})using(var root=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,view))using(var key=root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"))if(key!=null)foreach(string child in key.GetSubKeyNames())using(var entry=key.OpenSubKey(child)) {
            if(entry==null||!String.Equals(entry.GetValue("DisplayName") as string,"XIBERIA HUB",StringComparison.OrdinalIgnoreCase))continue;
            string directory=entry.GetValue("InstallLocation") as string;if(!String.IsNullOrEmpty(directory))candidates.Add(Path.Combine(directory,"XIBERIA HUB.exe"));
        }
        foreach(string root in new[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetEnvironmentVariable("ProgramW6432")})if(!String.IsNullOrEmpty(root))candidates.Add(Path.Combine(root,"XIBERIA HUB","XIBERIA HUB.exe"));
        string file=candidates.FirstOrDefault(File.Exists);if(file==null)throw new InvalidOperationException("未找到官方 APP，请重新运行安装包");
        return file;
    }
    static object LaunchOfficial() {
        string file=FindOfficialExecutable();
        // This branch is reached only by the explicit UI button; never during status polling.
        Process.Start(new ProcessStartInfo(file){UseShellExecute=true,WorkingDirectory=Path.GetDirectoryName(file)});
        return new {launched=true};
    }
    [STAThread] static void Main(string[] args) {
        var input=new StreamReader(Console.OpenStandardInput(),Encoding.UTF8);
        var output=new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true};
        Console.SetOut(TextWriter.Null);Console.SetError(TextWriter.Null);
        nativeRoot=Path.GetFullPath(args.Length>0?args[0]:Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"official"));
        SetDllDirectory(nativeRoot);
        AppDomain.CurrentDomain.AssemblyResolve+=(sender,eventArgs)=>{string path=Path.Combine(nativeRoot,new AssemblyName(eventArgs.Name).Name+".dll");return File.Exists(path)?Assembly.LoadFrom(path):null;};
        string line;
        while((line=input.ReadLine())!=null) {
            try {if(line.Length>131072)throw new ArgumentException("请求过长");output.WriteLine(Json.Serialize(new {ok=true,state=Dispatch(Json.Deserialize<Dictionary<string,object>>(line))}));}
            catch(Exception error) {while(error is TargetInvocationException && error.InnerException!=null)error=error.InnerException;output.WriteLine(Json.Serialize(new {ok=false,error=error is ArgumentException||error is InvalidOperationException?error.Message:"官方音效组件暂未就绪，请打开官方 APP 后重试"}));}
        }
    }
}
