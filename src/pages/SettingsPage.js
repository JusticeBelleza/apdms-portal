import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { setDoc, deleteDoc, doc } from 'firebase/firestore';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import ProgramFormModal from '../components/modals/ProgramFormModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import PermissionsManagement from './PermissionsManagement';

const SettingsPage = ({ programs, user, db }) => {
    const [showProgramModal, setShowProgramModal] = useState(false);
    const [editingProgram, setEditingProgram] = useState(null);
    const canManagePrograms = user.permissions?.canManagePrograms;

    // State for the confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [programToDelete, setProgramToDelete] = useState(null);

    const handleAddProgram = () => {
        setEditingProgram(null);
        setShowProgramModal(true);
    };
    
    const handleEditProgram = (program) => {
        setEditingProgram(program);
        setShowProgramModal(true);
    };

    const handleSaveProgram = async (programData) => {
        try {
            if (editingProgram) {
                const programDocRef = doc(db, 'programs', editingProgram.id);
                await setDoc(programDocRef, programData, { merge: true });
            } else {
                const newProgramId = programData.name.toLowerCase().replace(/\s+/g, '-');
                await setDoc(doc(db, "programs", newProgramId), { ...programData, id: newProgramId });
            }
            toast.success(`Program '${programData.name}' saved successfully!`);
            setShowProgramModal(false);
        } catch (error) {
            toast.error(`Failed to save program: ${error.message}`);
        }
    };

    // New delete process
    const handleDeleteClick = (programId) => {
        setProgramToDelete(programId);
        setShowConfirmModal(true);
    };

    const confirmDeleteProgram = async () => {
        if (!programToDelete) return;
        try {
            await deleteDoc(doc(db, "programs", programToDelete));
            toast.success('Program deleted successfully!');
        } catch (error) {
            toast.error(`Error deleting program: ${error.message}`);
        } finally {
            setShowConfirmModal(false);
            setProgramToDelete(null);
        }
    };

    return (
        <>
            <div className="space-y-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Settings</h1>
                
                {canManagePrograms && (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-700">Manage Health Programs</h2>
                            <button onClick={handleAddProgram} className="inline-flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300">
                                <PlusCircle className="w-5 h-5 md:mr-2"/>
                                <span className="hidden md:inline">Add Program</span>
                            </button>
                        </div>
                        <div className="space-y-2">
                            {programs.map(program => (
                                <div key={program.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                    <div>
                                        <p className="font-semibold">{program.name}</p>
                                        <p className="text-sm text-gray-500">Frequency: {program.frequency} | Type: {program.type}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => handleEditProgram(program)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        {!program.core && (
                                            <button onClick={() => handleDeleteClick(program.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {user.permissions?.canManagePermissions && <PermissionsManagement db={db} />}

                {showProgramModal && <ProgramFormModal program={editingProgram} onClose={() => setShowProgramModal(false)} onSave={handleSaveProgram} />}
            </div>

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmDeleteProgram}
                title="Delete Program"
                message="Are you sure you want to delete this program? This action cannot be undone."
            />
        </>
    );
};

export default SettingsPage;